import { Context } from '@temporalio/activity';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { CharacterSpec, StyleProfile } from '../types';
import { config } from '../shared';

const BOOKS_DIR = config.booksDataDir;

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export interface AlphaMetadata {
  hasTransparency: boolean;
  alphaRange: { min: number; max: number };
  dimensions: { width: number; height: number };
  fileSize: number;
}

/**
 * Build optimized character prompt (reuses existing buildPrompt)
 * Fast operation ~5s
 */
export async function buildCharacterPromptActivity(
  spec: CharacterSpec,
  profile?: StyleProfile
): Promise<{ prompt: string; stylePackId: string }> {
  const { buildPrompt } = await import('../lib/promptComposer.js');
  
  const traits = spec.traits?.join(', ') || 'friendly, cheerful';
  const pose = (profile as any)?.pose || 'standing upright, full body view';
  const expression = (profile as any)?.expression || 'happy, smiling';
  const stylePackId = (profile as any)?.stylePackId || 'storybook_watercolor';
  
  const maturityTag = spec.maturity && spec.maturity !== 'unspecified' ? `, maturity ${spec.maturity}` : '';
  const ageTag = typeof spec.age === 'number' ? `, age ${spec.age}` : '';
  const { prompt } = buildPrompt({
    category: `${spec.name} character${maturityTag}${ageTag}, ${traits}`,
    stylePackId: stylePackId as any,
    pose,
    expression,
    theme: spec.palette?.join(', '),
  });
  
  console.log(`[Character Prompt] Built for ${spec.name}`);
  
  return { prompt, stylePackId };
}

/**
 * Generate single variant (calls existing generatePngVariants with n=1)
 * Slow operation ~60-80s
 */
export async function generateSingleVariantActivity(
  bookId: string,
  variantIndex: number,
  prompt: string
): Promise<{ rawBuffer: Buffer; fileName: string }> {
  const { generatePngVariants } = await import('./openai.activities.js');
  
  console.log(`[Variant ${variantIndex}] Starting generation`);
  
  // Send heartbeat before starting
  try {
    Context.current().heartbeat({ 
      status: 'variant_gen:start', 
      variant: variantIndex 
    });
  } catch {}
  
  const startTime = Date.now();
  const result = await generatePngVariants({
    prompt,
    n: 1, // Generate only ONE variant
    size: '1024x1024',
    background: 'transparent',
  });
  
  const duration = Date.now() - startTime;
  console.log(`[Variant ${variantIndex}] Generated in ${Math.round(duration / 1000)}s`);
  
  // Send heartbeat after generation
  try {
    Context.current().heartbeat({ 
      status: 'variant_gen:complete', 
      variant: variantIndex,
      durationMs: duration
    });
  } catch {}
  
  return {
    rawBuffer: result.variants[0],
    fileName: `option-${String(variantIndex).padStart(2, '0')}.png`
  };
}

/**
 * Clean and optimize PNG (uses existing cleanPng)
 * Fast operation ~3-5s
 */
export async function cleanCharacterPngActivity(
  rawBuffer: Buffer,
  bookId: string,
  fileName: string
): Promise<{ cleanedBuffer: Buffer; metadata: AlphaMetadata }> {
  const { cleanPng } = await import('../lib/imageIO.js');
  
  console.log(`[Clean PNG] Processing ${fileName}`);
  
  const cleaned = await cleanPng(rawBuffer);
  
  // Extract metadata from cleaned PNG
  const stats = await sharp(cleaned).stats();
  const { width, height } = await sharp(cleaned).metadata();
  
  const metadata: AlphaMetadata = {
    hasTransparency: true,
    alphaRange: {
      min: stats.channels[3]?.min ?? 0,
      max: stats.channels[3]?.max ?? 255
    },
    dimensions: { width: width!, height: height! },
    fileSize: cleaned.length
  };
  
  console.log(`[Clean PNG] Completed ${fileName} - Alpha range: ${metadata.alphaRange.min}-${metadata.alphaRange.max}`);
  
  return { cleanedBuffer: cleaned, metadata };
}

/**
 * Save variant files to disk
 * Fast operation ~1-2s
 */
export async function saveCharacterVariantActivity(
  bookId: string,
  variantIndex: number,
  rawBuffer: Buffer,
  cleanedBuffer: Buffer
): Promise<{ rawPath: string; cleanPath: string }> {
  const characterDir = path.join(BOOKS_DIR, bookId, 'characters');
  const optionsDir = path.join(characterDir, 'options');
  await ensureDir(optionsDir);
  
  const rawFileName = `option-${String(variantIndex).padStart(2, '0')}-raw.png`;
  const cleanFileName = `option-${String(variantIndex).padStart(2, '0')}.png`;
  const rawPath = path.join(optionsDir, rawFileName);
  const cleanPath = path.join(optionsDir, cleanFileName);
  
  // Save both raw and cleaned versions
  await Promise.all([
    fs.writeFile(rawPath, rawBuffer),
    fs.writeFile(cleanPath, cleanedBuffer)
  ]);
  
  console.log(`[Save] Variant ${variantIndex}: ${rawFileName}, ${cleanFileName}`);
  
  // Verify files exist
  const [rawExists, cleanExists] = await Promise.all([
    fs.access(rawPath).then(() => true).catch(() => false),
    fs.access(cleanPath).then(() => true).catch(() => false)
  ]);
  
  if (!rawExists || !cleanExists) {
    throw new Error(`File verification failed: raw=${rawExists}, clean=${cleanExists}`);
  }
  
  return { rawPath, cleanPath };
}

/**
 * Score variant quality (NEW scoring system)
 * Fast operation ~2-3s
 */
export async function scoreCharacterQualityActivity(
  cleanedBuffer: Buffer,
  metadata: AlphaMetadata
): Promise<number> {
  const { scoreCharacterQuality } = await import('../lib/characterQuality.js');
  const score = await scoreCharacterQuality(cleanedBuffer, metadata);
  console.log(`[Quality Score] ${score}/100`);
  return score;
}

/**
 * Rank all variants by quality score
 * Fast operation ~1s
 */
export async function rankCharacterVariantsActivity(
  variants: Array<{ fileName: string; score: number }>
): Promise<Array<{ fileName: string; score: number; rank: number }>> {
  const ranked = variants
    .sort((a, b) => b.score - a.score)
    .map((v, i) => ({ ...v, rank: i + 1 }));
  
  console.log(`[Ranking] Best: ${ranked[0]?.fileName} (${ranked[0]?.score} pts)`);
  
  return ranked;
}

/**
 * Consolidated per-variant activity that avoids large gRPC payloads.
 * Generates ONE transparent PNG, cleans/validates, saves raw+clean, scores quality.
 * Returns only file paths and small metadata (no Buffers over gRPC).
 */
export async function generateAndSaveVariantActivity(
  bookId: string,
  variantIndex: number,
  prompt: string
): Promise<{
  fileName: string;
  rawPath: string;
  cleanPath: string;
  metadata: AlphaMetadata;
  score: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  const characterDir = path.join(BOOKS_DIR, bookId, 'characters');
  const optionsDir = path.join(characterDir, 'options');
  await ensureDir(optionsDir);
  
  const rawFileName = `option-${String(variantIndex).padStart(2, '0')}-raw.png`;
  const cleanFileName = `option-${String(variantIndex).padStart(2, '0')}.png`;
  const rawPath = path.join(optionsDir, rawFileName);
  const cleanPath = path.join(optionsDir, cleanFileName);
  
  // Heartbeat: start
  try {
    Context.current().heartbeat({ status: 'variant:start', variant: variantIndex });
  } catch {}
  
  // 1) Generate one transparent PNG (no buffer leaves this activity)
  const { generatePngVariants } = await import('./openai.activities.js');
  const genStart = Date.now();
  const gen = await generatePngVariants({ prompt, n: 1, size: '1024x1024', background: 'transparent' });
  const genDuration = Date.now() - genStart;
  try { Context.current().heartbeat({ status: 'variant:generated', variant: variantIndex, durationMs: genDuration }); } catch {}
  
  // 2) Save raw immediately to disk
  await fs.writeFile(rawPath, gen.variants[0]);
  
  // 3) Clean/defringe/validate and save cleaned
  const { cleanPng } = await import('../lib/imageIO.js');
  const cleaned = await cleanPng(gen.variants[0]);
  await fs.writeFile(cleanPath, cleaned);
  
  // 4) Build metadata
  const stats = await sharp(cleaned).stats();
  const metaInfo = await sharp(cleaned).metadata();
  const metadata: AlphaMetadata = {
    hasTransparency: true,
    alphaRange: { min: stats.channels[3]?.min ?? 0, max: stats.channels[3]?.max ?? 255 },
    dimensions: { width: metaInfo.width || 0, height: metaInfo.height || 0 },
    fileSize: cleaned.length,
  };
  
  // 5) Score quality
  const { scoreCharacterQuality } = await import('../lib/characterQuality.js');
  const score = await scoreCharacterQuality(cleaned, metadata);
  
  // Verify files exist (best-effort)
  try {
    await fs.access(rawPath);
    await fs.access(cleanPath);
  } catch {
    throw new Error('File verification failed after write');
  }
  
  const durationMs = Date.now() - startTime;
  console.log(`[Variant ${variantIndex}] Saved. Score=${score}, raw=${rawPath}, clean=${cleanPath}`);
  try { Context.current().heartbeat({ status: 'variant:done', variant: variantIndex, durationMs }); } catch {}
  
  return {
    fileName: cleanFileName,
    rawPath,
    cleanPath,
    metadata,
    score,
    durationMs,
  };
}

