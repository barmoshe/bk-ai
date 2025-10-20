import OpenAI from 'openai';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { Context } from '@temporalio/activity';
import { ApplicationFailure } from '@temporalio/common';
import { CharacterSpec, BookPrefs, PageJSON, StyleProfile, PageLayoutPlan, BorderEffectType, BorderEffectConfig } from '../types';
import { buildPageImagePrompt } from '../lib/prompts/pageImage';
import { composeImagePrompt } from '../lib/promptComposer';
import { exists } from '../lib/cache';
import { imageConfig } from '../shared';
import { retry } from '../lib/retry';
import { PagesResponseSchemaJson, validatePagesResponse } from '../lib/schemas';
import { refinePageText, engagementRefine, buildPlacementHint, getVariationCues } from '../lib';
import { determineAgeGroup, TEXT_RULES, validateAgainstRules, refineToAgeRules, enforceTextToRules } from '../lib/ageRules';
import { generateImageUrl } from '../lib/imageProvider';
import { runStructuredPrompt } from '../lib/promptRunner';
import { buildSystem as buildPagesSystem, buildUser as buildPagesUser, PAGES_PROMPT_VERSION } from '../lib/prompts/pages.prompt';
import { canonicalizeSpec, deriveCharacterBibleEntry } from '../lib/spec';
import { validateSpeciesContinuity, normalizeImagePromptSpecies } from '../lib/consistency';
import { buildSystem as buildCriticSystem, buildUser as buildCriticUser, CRITIC_PROMPT_VERSION } from '../lib/prompts/critic.prompt';

import { config } from '../shared';
import { fetchWithRetry } from '../lib/http';
import * as rateLimit from '../lib/rateLimiter';

let client: OpenAI | undefined;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: config.getApiKey() });
  }
  return client;
}

const BOOKS_DIR = config.booksDataDir;
const OPENAI_IMAGE_SIZE = config.image.size;
const OPENAI_PAGES_TIMEOUT_MS = config.timeouts.pages;

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function parseSize(size: string): { w: number; h: number } {
  const m = size.match(/^(\d+)x(\d+)$/);
  if (!m) return { w: 1024, h: 1024 };
  return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
}

async function writeErrorLog(bookId: string, message: string) {
  try {
    const logPath = path.join(BOOKS_DIR, bookId, 'errors.log');
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {}
}

async function writePromptArtifact(
  bookId: string,
  filename: string,
  data: any,
): Promise<void> {
  try {
    const promptsDir = path.join(BOOKS_DIR, bookId, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
    const outPath = path.join(promptsDir, filename);
    await fs.writeFile(outPath, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: any;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

async function createPlaceholderPng(outPath: string, label: string, sizeStr: string) {
  const { w, h } = parseSize(sizeStr);
  const bg = await sharp({ create: { width: w, height: h, channels: 3, background: '#f3e8ff' } })
    .png()
    .toBuffer();
  const svg = `<svg width="${w}" height="${h}">
    <rect x="20" y="20" width="${w - 40}" height="${h - 40}" rx="24" fill="#ffffff" stroke="#c084fc" stroke-width="4" />
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Helvetica, Arial" font-size="${Math.max(20, Math.floor(w * 0.04))}" fill="#6b21a8">${label}</text>
  </svg>`;
  await sharp(bg)
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .png()
    .toFile(outPath);
}

/**
 * Download image with periodic heartbeats to prevent timeout
 */
async function downloadImage(url: string): Promise<Buffer> {
  const startTime = Date.now();
  try {
    Context.current().heartbeat({ status: 'download:start', url });
  } catch {
    // Not in activity context, skip heartbeat
  }
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const duration = Date.now() - startTime;
  
  try {
    Context.current().heartbeat({ status: 'download:done', durationMs: duration, size: arrayBuffer.byteLength });
  } catch {
    // Not in activity context, skip heartbeat
  }
  return Buffer.from(arrayBuffer);
}

/**
 * Generate character image options with transparent backgrounds
 * Uses professional PNG generation with alpha channel processing
 */
export async function generateCharacterImageOptions(
  bookId: string,
  spec: CharacterSpec,
  profile?: StyleProfile,
): Promise<string[]> {
  const startTime = Date.now();
  console.log(`[Character] Starting generation of 4 transparent PNG options`);
  
  const characterDir = path.join(BOOKS_DIR, bookId, 'characters');
  const optionsDir = path.join(characterDir, 'options');
  await ensureDir(optionsDir);

  // Build optimized prompt for transparent PNG character
  const { buildPrompt } = await import('../lib/promptComposer.js');
  const { cleanPng } = await import('../lib/imageIO.js');
  
  // Determine character description
  const traits = spec.traits?.join(', ') || 'friendly, cheerful';
  const pose = (profile as any)?.pose || 'standing upright, full body view';
  const expression = (profile as any)?.expression || 'happy, smiling';
  const stylePackId = (profile as any)?.stylePackId || 'storybook_watercolor';
  
  const maturityTag = spec.maturity && spec.maturity !== 'unspecified' ? `, maturity ${spec.maturity}` : '';
  const ageTag = typeof spec.age === 'number' ? `, age ${spec.age}` : '';
  const { prompt, stylePack } = buildPrompt({
    category: `${spec.name} character${maturityTag}${ageTag}, ${traits}`,
    stylePackId: stylePackId as any,
    pose: pose,
    expression: expression,
    theme: spec.palette?.join(', '),
  });

  console.log(`[Character] Using transparent PNG prompt for ${spec.name}`);
  
  // Send initial heartbeat
  try {
    Context.current().heartbeat({ 
      status: 'character_gen:start', 
      variants: 4,
      transparent: true
    });
  } catch {}

  const variants = 4;
  const names: string[] = [];
  
  // Generate all variants using professional transparent PNG method
  try {
    const result = await generatePngVariants({
      prompt,
      n: variants,
      size: '1024x1024',
      background: 'transparent',
    });
    
    console.log(`[Character] Generated ${result.variants.length} variants in ${result.attempts} attempts`);
    
    // Process each variant
    for (let i = 0; i < result.variants.length; i++) {
      const variantNum = i + 1;
      const rawFileName = `option-${String(variantNum).padStart(2, '0')}-raw.png`;
      const cleanFileName = `option-${String(variantNum).padStart(2, '0')}.png`;
      const rawPath = path.join(optionsDir, rawFileName);
      const cleanPath = path.join(optionsDir, cleanFileName);
      
      try {
        // Save raw variant
        await fs.writeFile(rawPath, result.variants[i]);
        console.log(`[Character] Saved raw variant ${variantNum}: ${rawFileName}`);
        
        // Clean and optimize PNG (defringe, smooth alpha, validate transparency)
        try {
          const cleaned = await cleanPng(result.variants[i]);
          await fs.writeFile(cleanPath, cleaned);
          console.log(`[Character] Cleaned variant ${variantNum}: ${cleanFileName}`);
          names.push(cleanFileName);
          
          // Send heartbeat
          try {
            Context.current().heartbeat({ 
              status: 'character_gen:processed', 
              current: variantNum,
              total: variants,
              elapsedMs: Date.now() - startTime
            });
          } catch {}
        } catch (cleanError: any) {
          console.warn(`[Character] Failed to clean variant ${variantNum}, using raw: ${cleanError.message}`);
          // If cleaning fails, use raw version
          await fs.copyFile(rawPath, cleanPath);
          names.push(cleanFileName);
        }
      } catch (e: any) {
        console.error(`[Character] Failed to save variant ${variantNum}:`, e.message);
        await writeErrorLog(bookId, `character option ${variantNum} save failed: ${String(e?.message || e)}`);
        
        // Create placeholder if allowed
        if (config.features.allowPlaceholder) {
          const placeholderPath = path.join(optionsDir, cleanFileName);
          await createPlaceholderPng(placeholderPath, `Character ${variantNum}`, '1024x1024');
          names.push(cleanFileName);
        }
      }
    }
  } catch (e: any) {
    console.error(`[Character] PNG variant generation failed:`, e.message);
    await writeErrorLog(bookId, `character PNG generation failed: ${String(e?.message || e)}`);
    
    // Fallback: create placeholder options if allowed
    if (config.features.allowPlaceholder) {
      for (let i = 1; i <= variants; i++) {
        const fileName = `option-${String(i).padStart(2, '0')}.png`;
        const outPath = path.join(optionsDir, fileName);
        await createPlaceholderPng(outPath, `Character ${i}`, '1024x1024');
        names.push(fileName);
      }
    } else {
      throw e;
    }
  }
  
  const totalDuration = Date.now() - startTime;
  console.log(`[Character] All ${names.length} options completed in ${Math.round(totalDuration / 1000)}s`);
  console.log(`[Character] Options: ${names.join(', ')}`);
  
  // Final heartbeat
  try {
    Context.current().heartbeat({ 
      status: 'character_gen:done', 
      count: names.length,
      transparent: true,
      durationMs: totalDuration
    });
  } catch {}
  
  return names;
}

export async function generateOutlineAndPagesJSON(
  bookId: string,
  spec: CharacterSpec,
  prefs: BookPrefs,
  profile?: StyleProfile,
): Promise<PageJSON[]> {
  const model = config.models.pages;
  const temperature = config.temperatures.pages;

  let pagesObj: any = null;
  // Keep activity alive during potentially slow model call
  const hbInterval = setInterval(() => {
    try {
      Context.current().heartbeat({ step: 'pages', status: 'waiting' });
    } catch {
      clearInterval(hbInterval);
    }
  }, 15000);
  try {
    try {
      Context.current().heartbeat({ step: 'pages', status: 'start' });
    } catch {}
    // Canonicalize and validate spec before prompt build
    const canon = canonicalizeSpec(spec, profile);
    if (!canon.traits?.length) throw new Error('CharacterSpec missing traits');
    if (!canon.palette?.length) throw new Error('CharacterSpec missing palette');
    if (!canon.style) throw new Error('CharacterSpec missing style');

    pagesObj = await runStructuredPrompt({
      bookId,
      step: 'pages',
      version: PAGES_PROMPT_VERSION,
      model,
      temperature,
      system: buildPagesSystem(prefs),
      user: (() => {
        // Append strong guidance for border selection (favor non-'none') without changing schema
        const base = buildPagesUser(canon, prefs);
        const guidance = `\n\nAdditional layout guidance (non-breaking): For each page, choose a borderEffect from this set: [professionalFrame, paintedEdge, modernCard, vintageFrame, storybookCorners, softVignette, photoMatte, tornPaper, polaroid, sketchDrawn, comicBook, neonGlow, filmStrip]. Prefer a tasteful subtle effect by default (professionalFrame or paintedEdge). Only use 'none' if a border would clash with composition or reduce readability. Consider age, mood, and style: younger/playful → storybookCorners or modernCard; watercolor → paintedEdge; classic → professionalFrame or vintageFrame; cinematic/action → comicBook or filmStrip; emotional focus → softVignette; gallery/clean → photoMatte; handmade/scrapbook → tornPaper or polaroid. Return 'borderEffect' and optional 'borderConfig' per page.`;
        return typeof base === 'string' ? base + guidance : base;
      })(),
      schema: { name: 'PagesResponse', schema: PagesResponseSchemaJson },
      timeoutMs: OPENAI_PAGES_TIMEOUT_MS,
    });
  } catch (e: any) {
    await writeErrorLog(bookId, `pages gen failed: ${String(e?.message || e)}`);
    pagesObj = { pages: [] };
  } finally {
    clearInterval(hbInterval);
    try {
      Context.current().heartbeat({ step: 'pages', status: 'done' });
    } catch {}
  }

  // Validate and coerce to our expected length/shape
  let pages = validatePagesResponse(pagesObj, prefs);
  await writePromptArtifact(bookId, 'pages-validated.json', { pages });

  // Optional critic pass: review each page for age/tone appropriateness
  if (config.features.critic) {
    for (const page of pages) {
      const critique = await critiquePageText(bookId, page, prefs);
      if (!critique.approved && critique.suggestion) {
        // Replace text with suggestion if not approved
        page.text = critique.suggestion;
      }
      // If low engagement, try a gentle engagement refine before final validation
      const boringness = typeof (critique as any)?.boringness === 'number' ? (critique as any).boringness : 0;
      if (boringness > 0.6 && page.text) {
        const ageGroup = prefs.ageGroup || determineAgeGroup(prefs.targetAge);
        page.text = await engagementRefine({
          text: page.text,
          tone: prefs.tone,
          title: prefs.title,
          pageIndex: page.pageIndex,
          ageGroup,
        });
      }
    }
  }

  // Validate → refine (up to 2 passes) → clamp as last resort, with species continuity
  {
    const refined: PageJSON[] = [];
    const ageGroup = prefs.ageGroup || determineAgeGroup(prefs.targetAge);
    const rules = TEXT_RULES[ageGroup];
    // Infer expected species once from canonical spec/profile to guide continuity
    let expectedSpecies: string | undefined;
    const canonLocal = canonicalizeSpec(spec, profile);
    try {
      const bible = deriveCharacterBibleEntry(canonLocal, profile);
      expectedSpecies = String(bible?.species || '').toLowerCase() || undefined;
    } catch {}
    for (const p of pages) {
      let text = p.text;
      if (text) {
        let check = validateAgainstRules(text, rules, ageGroup);
        if (!check.ok && config.features.textRefine) {
          // Pass 1
          const simplified1 = await refineToAgeRules({
            text,
            ageGroup,
            tone: prefs.tone,
            title: prefs.title,
            pageIndex: p.pageIndex,
          });
          let recheck = validateAgainstRules(simplified1, rules, ageGroup);
          if (recheck.ok) {
            text = simplified1;
          } else {
            // Pass 2
            const simplified2 = await refineToAgeRules({
              text: simplified1,
              ageGroup,
              tone: prefs.tone,
              title: prefs.title,
              pageIndex: p.pageIndex,
            });
            recheck = validateAgainstRules(simplified2, rules, ageGroup);
            text = recheck.ok ? simplified2 : enforceTextToRules(simplified2, rules, ageGroup);
          }
        } else if (!check.ok) {
          // Refinement disabled; clamp
          text = enforceTextToRules(text, rules, ageGroup);
        }
      }
      // Species continuity check and optional one-shot rewrite
      if (text && expectedSpecies && expectedSpecies !== 'human') {
        const cont = validateSpeciesContinuity(text, expectedSpecies);
        if (!cont.ok && config.features.textRefine) {
          try {
            const prompt = [
              'Rewrite to fix species-specific mismatches while preserving meaning.',
              `Expected species: ${expectedSpecies}.`,
              'Do not change layout or the imagePrompt field.',
              'Keep sentences count and max words per sentence the same.',
              `Text: ${text}`,
              'Return only the rewritten text.',
            ].join('\n');
            const resp = await runStructuredPrompt({
              bookId,
              step: `pages-continuity-${p.pageIndex}`,
              version: 'species-continuity-v1',
              model,
              temperature: Math.min(0.5, temperature),
              system: 'You are a careful copy editor. Output plain text only.',
              user: prompt,
              schema: undefined as any,
              timeoutMs: Math.min(OPENAI_PAGES_TIMEOUT_MS, 10000),
            }).catch(() => null);
            if (resp && typeof resp === 'string') {
              const candidate = String(resp).trim();
              const recheck = validateSpeciesContinuity(candidate, expectedSpecies);
              if (recheck.ok) text = candidate;
            }
          } catch {}
        }
      }
      const sentences = text ? text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean) : [];
      // Border selection: map AI-provided fields if present; default to none
      let borderEffect: BorderEffectType | undefined = (p as any)?.borderEffect || undefined;
      const borderConfig: BorderEffectConfig | undefined = (p as any)?.borderConfig || undefined;

      // Deterministic fallback: prefer a tasteful default if missing
      if (!borderEffect || borderEffect === 'none') {
        // Simple heuristic based on layout and tone
        const layoutForBorder = p.layout || 'imageTop';
        if (/imageTop|imageLeft|imageRight/i.test(layoutForBorder)) {
          borderEffect = 'professionalFrame';
        }
      }

      refined.push({
        ...p,
        text,
        formatted: sentences.length ? { lines: sentences } : undefined,
        borderEffect: borderEffect ?? 'professionalFrame',
        borderConfig,
      });
    }
    pages = refined;
  }

  for (const page of pages) {
    const pageDir = path.join(BOOKS_DIR, bookId, 'pages', String(page.pageIndex));
    await ensureDir(pageDir);
    const pagePath = path.join(pageDir, 'page.json');
    await fs.writeFile(pagePath, JSON.stringify(page, null, 2), 'utf8');
  }
  return pages;
}

/**
 * Generate page illustration with improved heartbeat mechanism and error handling
 */
export async function generatePageIllustrationPNG(
  bookId: string,
  page: PageJSON,
  spec: CharacterSpec,
  profile?: StyleProfile,
  plan?: PageLayoutPlan,
  prefs?: BookPrefs,
): Promise<string> {
  const startTime = Date.now();
  const pageIndex = page.pageIndex;
  
  // Log start
  console.log(`[Page ${pageIndex}] Starting image generation`);
  
  // Build image prompt using style cues; first normalize species wording in page.imagePrompt
  try {
    const bible = deriveCharacterBibleEntry(spec, profile);
    // Prefer explicit user-provided kind
    const expectedSpecies = String((spec as any)?.characterKind || bible?.species || '').toLowerCase();
    const NON_HUMAN = new Set(['dog','cat','fox','rabbit','bear','elephant','giraffe','lion','tiger','bird','dinosaur','dragon']);
    if (expectedSpecies && NON_HUMAN.has(expectedSpecies) && page.imagePrompt) {
      page = { ...page, imagePrompt: normalizeImagePromptSpecies(page.imagePrompt, expectedSpecies) };
    }
  } catch {}
  let prompt = composeImagePrompt(spec, page, profile, {
    subjectOverride: (spec as any)?.characterKind,
    subjectDetails: (spec as any)?.characterKindDetails,
  });
  // Age-tuned style cues for the image prompt (non-jargony)
  if (prefs?.ageGroup || typeof prefs?.targetAge === 'number') {
    const target = prefs.ageGroup || determineAgeGroup(prefs.targetAge);
    const extras: string[] = [];
    if (target === 'T2' || target === 'F2T3') {
      extras.push('big simple shapes, chunky outlines, single clear focal point, simple background, saturated colors');
    } else if (target === 'F3T5') {
      extras.push('simple composition, 1-2 small storytelling details, mid-to-high saturation, gentle shading');
    } else if (target === 'F5T7') {
      extras.push('dynamic but readable composition, light shading, mid saturation, clear foreground/background');
    } else {
      extras.push('richer scene with 2-3 details, perspective hints, balanced palette, subtle lighting');
    }
    prompt = `${prompt} ${extras.join('. ')}.`.trim();
  }

  // Persist prompt artifact for debugging
  await writePromptArtifact(bookId, `image-page-${page.pageIndex}-request.json`, {
    prompt,
    provider: config.image.provider,
    model: imageConfig.model,
    size: OPENAI_IMAGE_SIZE,
    pageIndex: page.pageIndex,
    timestamp: new Date().toISOString(),
  });

  let buf: Buffer | null = null;
  let generationAttempt = 0;
  
  try {
    // Send initial heartbeat
    try {
      Context.current().heartbeat({ 
        status: 'image_gen:start', 
        page: pageIndex,
        timestamp: Date.now() 
      });
    } catch {
      // Not in activity context
    }

    // Prefer simple provider if explicitly selected; otherwise keep robust fallback
    if (config.image.provider === 'openai_simple') {
      const apiKey = config.getApiKey();
      if (!apiKey) throw ApplicationFailure.nonRetryable('OPENAI_API_KEY not set');
      
      generationAttempt++;
      console.log(`[Page ${pageIndex}] Attempt ${generationAttempt}: Calling OpenAI API`);
      
      // Set up periodic heartbeat during the API call
      const heartbeatInterval = setInterval(() => {
        try {
          const elapsed = Date.now() - startTime;
          Context.current().heartbeat({ 
            status: 'image_gen:waiting', 
            page: pageIndex,
            attempt: generationAttempt,
            elapsedMs: elapsed
          });
          console.log(`[Page ${pageIndex}] Heartbeat sent (${Math.round(elapsed / 1000)}s elapsed)`);
        } catch (err) {
          // Context may not be available, clear interval
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Send heartbeat every 30 seconds

      try {
        // Add timeout to the fetch request using configured image timeout
        const idem = `img:${bookId}:${page.pageIndex}:${Buffer.from(prompt).toString('base64').slice(0,24)}`;
        // Rate limit and concurrency guard
        await rateLimit.take('openai');
        const response = await rateLimit.withConcurrency('openai', async () => {
          return fetchWithRetry({
            url: 'https://api.openai.com/v1/images/generations',
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: imageConfig.model, prompt, size: OPENAI_IMAGE_SIZE }),
            timeoutMs: config.timeouts.image,
            idempotencyKey: idem,
            maxAttempts: 3,
            onRetry: async ({ delayMs, attempt, status }) => {
              try {
                Context.current().heartbeat({ 
                  status: 'image_gen:retry_scheduled', 
                  page: pageIndex,
                  attempt,
                  retryInMs: delayMs,
                  httpStatus: status
                });
              } catch {}
            },
          });
        });
        
        clearInterval(heartbeatInterval);
        
        if (!response.ok) {
          const errText = await response.text();
          const error = new Error(`Image API ${response.status}: ${errText}`);
          
          // Determine if retryable
          if (response.status === 429 || response.status >= 500) {
            console.log(`[Page ${pageIndex}] Retryable error: ${response.status}`);
            throw error; // Retryable
          } else {
            console.log(`[Page ${pageIndex}] Non-retryable error: ${response.status}`);
            throw ApplicationFailure.nonRetryable(error.message);
          }
        }
        
        const json: any = await response.json();
        console.log(`[Page ${pageIndex}] OpenAI API response received`);
        
        // Send heartbeat after receiving response
        try {
          Context.current().heartbeat({ 
            status: 'image_gen:response_received', 
            page: pageIndex,
            elapsedMs: Date.now() - startTime
          });
        } catch {}
        
        // Accept both url and b64_json
        const first = json.data?.[0];
        const imageUrl = first?.url;
        const b64 = first?.b64_json;
        
        if (imageUrl) {
          console.log(`[Page ${pageIndex}] Downloading image from URL`);
          buf = await downloadImage(imageUrl);
        } else if (b64) {
          console.log(`[Page ${pageIndex}] Decoding base64 image`);
          buf = Buffer.from(b64, 'base64');
          try {
            Context.current().heartbeat({ 
              status: 'image_gen:decoded_b64', 
              page: pageIndex,
              size: buf.length
            });
          } catch {}
        } else {
          // Log response shape for debugging
          await writePromptArtifact(bookId, `image-page-${page.pageIndex}-response-error.json`, {
            ok: false,
            error: 'Missing url and b64_json',
            responseShape: json,
            timestamp: new Date().toISOString(),
          });
          throw ApplicationFailure.nonRetryable('Image response missing url/b64_json');
        }
        
        await writePromptArtifact(bookId, `image-page-${page.pageIndex}-response.json`, {
          ok: true,
          provider: config.image.provider,
          hadUrl: !!imageUrl,
          hadB64: !!b64,
          attempt: generationAttempt,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        clearInterval(heartbeatInterval);
        console.error(`[Page ${pageIndex}] Error during generation:`, err.message);
        throw err;
      }
    } else {
      // Fallback provider with retry logic
      console.log(`[Page ${pageIndex}] Using fallback provider`);
      
      const image = await generateImageWithFallback({ prompt, useHd: true });
      const first = image.data?.[0];
      
      if (first?.url) {
        buf = await downloadImage(first.url);
      } else if ((first as any)?.b64_json) {
        buf = Buffer.from((first as any).b64_json, 'base64');
      } else {
        await writePromptArtifact(bookId, `image-page-${page.pageIndex}-response-error.json`, {
          ok: false,
          error: 'No url or b64_json in fallback response',
          timestamp: new Date().toISOString(),
        });
        throw ApplicationFailure.nonRetryable('Image generation returned no data');
      }
      
      await writePromptArtifact(bookId, `image-page-${page.pageIndex}-response.json`, {
        ok: true,
        provider: 'fallback',
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      // Emit heartbeats periodically during slow IO to prevent heartbeat timeout
      Context.current().heartbeat({ 
        status: 'image_gen:downloaded', 
        page: pageIndex,
        size: buf!.length,
        totalDurationMs: Date.now() - startTime
      });
    } catch {}
    
    console.log(`[Page ${pageIndex}] Image generation completed in ${Math.round((Date.now() - startTime) / 1000)}s`);
  } catch (e: any) {
    const errorMsg = String(e?.message || e);
    console.error(`[Page ${pageIndex}] Image generation failed:`, errorMsg);
    
    await writeErrorLog(
      bookId,
      `page ${page.pageIndex} image gen failed (attempt ${generationAttempt}): ${errorMsg}`,
    );
    await writePromptArtifact(bookId, `image-page-${page.pageIndex}-response.json`, {
      ok: false,
      error: errorMsg,
      attempt: generationAttempt,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
    
    // Check if we should use placeholder
    if (config.features.allowPlaceholder) {
      console.log(`[Page ${pageIndex}] Using placeholder image`);
      const tmp = path.join(BOOKS_DIR, bookId, 'tmp-placeholder.png');
      await createPlaceholderPng(tmp, `Page ${page.pageIndex}`, OPENAI_IMAGE_SIZE);
      buf = await fs.readFile(tmp);
      
      try {
        Context.current().heartbeat({ 
          status: 'image_gen:placeholder_used', 
          page: pageIndex
        });
      } catch {}
    } else {
      throw e;
    }
  }
  
  // Lightweight continuity check: detect obvious species drift for non-human characters
  try {
    const manifestPath = path.join(BOOKS_DIR, bookId, 'manifest.json');
    let expectedSpecies: string | undefined;
    try {
      const raw = await fs.readFile(path.join(BOOKS_DIR, bookId, 'character.json'), 'utf8');
      const bible = JSON.parse(raw);
      expectedSpecies = String(bible?.species || '').toLowerCase();
    } catch {
      // Attempt to infer from spec.name fallback
      if (/dog/i.test(spec.name)) expectedSpecies = 'dog';
    }
    if (expectedSpecies && expectedSpecies !== 'human') {
      // Ask vision model to classify subject as human vs expected species
      const dataUrl = `data:image/png;base64,${buf!.toString('base64')}`;
      const system = `Respond JSON { species: string, isHuman: boolean }`;
      const userText = `What is the primary subject species in this children's book illustration?`;
      const result = await getClient().chat.completions.create({
        model: config.models.vision,
        response_format: { type: 'json_object' } as any,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [ { type: 'text', text: userText } as any, { type: 'image_url', image_url: { url: dataUrl } } as any ] as any },
        ],
      });
      let drift: boolean = false; let detected: string | undefined;
      try {
        const content = result.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        detected = String(parsed?.species || '').toLowerCase();
        const isHuman: boolean = Boolean(parsed?.isHuman);
        drift = Boolean(isHuman || (detected ? detected !== expectedSpecies : false));
      } catch {}
      let continuityAttempts = Math.max(1, generationAttempt);
      let usedStrongPrompt = false;
      let strongPromptSnippet: string | undefined = undefined;
      // If drift, strengthen prompt and regenerate once
      if (drift) {
        const strong = `${prompt} Subject: ${expectedSpecies}. Avoid depicting humans; focus on the named animal.`;
        strongPromptSnippet = `Subject: ${expectedSpecies}. Avoid depicting humans; focus on the named animal.`;
        try { Context.current().heartbeat({ status: 'image_gen:continuity_retry', page: pageIndex }); } catch {}
        // Simple single retry using same provider
        const apiKey = config.getApiKey();
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: imageConfig.model, prompt: strong, size: OPENAI_IMAGE_SIZE })
        });
        if (response.ok) {
          const json: any = await response.json();
          const first = json.data?.[0];
          if (first?.url) buf = await downloadImage(first.url);
          else if (first?.b64_json) buf = Buffer.from(first.b64_json, 'base64');
          usedStrongPrompt = true;
          continuityAttempts += 1;
        }
      }
      // Save continuity artifact
      try {
        const contPath = path.join(BOOKS_DIR, bookId, 'pages', String(page.pageIndex), 'continuity.json');
        await fs.writeFile(contPath, JSON.stringify({ expectedSpecies, detectedSpecies: detected, drift, attempts: continuityAttempts, usedStrongPrompt, strongPromptSnippet }, null, 2), 'utf8');
      } catch {}
    }
  } catch {}
  
  // Write file with chunking and heartbeats
  const pageDir = path.join(BOOKS_DIR, bookId, 'pages', String(page.pageIndex));
  await ensureDir(pageDir);
  const outPath = path.join(pageDir, 'illustration.png');
  const previewPath = path.join(pageDir, 'preview.jpg');
  
  if (await exists(outPath)) {
    console.log(`[Page ${pageIndex}] File already exists, skipping write`);
    return outPath;
  }
  
  // Chunked write with intermittent heartbeat to keep long writes alive
  console.log(`[Page ${pageIndex}] Writing file (${buf!.length} bytes)`);
  const chunkSize = 1024 * 128;
  let offset = 0;
  while (offset < buf!.length) {
    const end = Math.min(offset + chunkSize, buf!.length);
    const slice = buf!.subarray(offset, end);
    if (offset === 0) await fs.writeFile(outPath, slice);
    else await fs.appendFile(outPath, slice);
    offset = end;
    try { 
      Context.current().heartbeat({ 
        status: 'image_gen:writing', 
        page: pageIndex, 
        offset,
        total: buf!.length,
        progress: Math.round((offset / buf!.length) * 100)
      }); 
    } catch {}
  }
  
  // Additionally, write a quick progressive JPEG preview for perceived streaming
  try {
    const { w, h } = parseSize(OPENAI_IMAGE_SIZE);
    const previewMax = Math.max(256, Math.min(512, Math.floor(Math.max(w, h) / 2)));
    const previewBuf = await sharp(buf!)
      .resize({ width: w >= h ? previewMax : undefined, height: h > w ? previewMax : undefined, fit: 'inside' })
      .jpeg({ quality: 70, progressive: true, mozjpeg: true, chromaSubsampling: '4:2:0' as any })
      .toBuffer();
    await fs.writeFile(previewPath, previewBuf);
    try {
      Context.current().heartbeat({ status: 'image_gen:preview_written', page: pageIndex, previewBytes: previewBuf.length });
    } catch {}
  } catch (e: any) {
    console.warn(`[Page ${pageIndex}] Failed to write preview.jpg: ${e?.message || e}`);
  }
  
  console.log(`[Page ${pageIndex}] File written successfully`);
  return outPath;
}

// --- Moderation & Fallback helpers ---
async function moderate(text: string): Promise<void> {
  if (!config.features.moderation) return;
  try {
    await getClient().moderations.create({ model: 'omni-moderation-latest', input: text } as any);
  } catch {
    // best-effort moderation
  }
}

type ImageGenParams = { prompt: string; useHd: boolean };

async function generateImageWithFallback({ prompt, useHd }: ImageGenParams) {
  await moderate(prompt);
  const models = config.image.fallbacks;
  const sizes = config.image.reduceSizes;
  const quality = (useHd ? config.image.quality : 'standard') as any;
  const preferred = config.models.image;

  for (const model of [preferred, ...models.filter(m => m !== preferred)]) {
    for (const size of sizes) {
      try {
        const isGptImage = /gpt-image-1/i.test(model);
        const req: any = {
          model: model as any,
          prompt,
          size: size as any,
          response_format: isGptImage ? 'b64_json' : 'url',
        };
        if (!isGptImage) req.quality = quality;
        if (isGptImage) req.background = 'transparent';
        const res = await getClient().images.generate(req);
        return res;
      } catch (e: any) {
        const msg = String(e?.message || e);
        const retriable = /429|quota|rate|timeout|Too Many Requests/i.test(msg) || /403/.test(msg);
        if (!retriable && !/dall-e-3|dall-e-2|gpt-image-1/.test(model)) throw e;
        // otherwise continue to next size/model
      }
    }
  }
  throw new Error('All image generation fallbacks failed');
}

/**
 * Generate transparent PNG variants with improved quality and reliability
 * Optimized for characters, objects, and decorative elements
 */
export async function generatePngVariants(args: {
  prompt: string;
  n?: number;
  size?: '1024x1024';
  background?: 'transparent';
}): Promise<{ variants: Buffer[]; attempts: number }>
{
  const startTime = Date.now();
  const n = Math.max(1, Math.min(4, args.n ?? imageConfig.variants));
  const size = (args.size ?? imageConfig.objectPng.size) as '1024x1024';
  const background = args.background ?? 'transparent';
  const apiKey = config.getApiKey();
  
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  
  console.log(`[PNG Variants] Generating ${n} transparent PNG variants`);
  
  // Send initial heartbeat
  try {
    Context.current().heartbeat({ 
      status: 'png_variants:start', 
      count: n,
      background 
    });
  } catch {}
  
  // Enhance prompt for better transparent background results
  const enhancedPrompt = background === 'transparent' 
    ? `${args.prompt}, isolated on transparent background, clean edges, no shadows, centered composition, high detail, professional cutout`
    : args.prompt;
  
  let attempts = 0;
  const variants: Buffer[] = [];
  
  for (let i = 0; i < n; i++) {
    console.log(`[PNG Variants] Generating variant ${i + 1}/${n}`);
    
    // Send heartbeat for each variant
    try {
      Context.current().heartbeat({ 
        status: 'png_variants:generating', 
        current: i + 1,
        total: n,
        elapsedMs: Date.now() - startTime
      });
    } catch {}
    
    const buf = await retry(async () => {
      attempts += 1;
      const controller = new AbortController();
      const to = setTimeout(() => {
        console.log(`[PNG Variants] Request timeout after ${imageConfig.timeoutMs}ms`);
        controller.abort();
      }, imageConfig.timeoutMs);
      
      // Set up heartbeat during long API call
      const heartbeatInterval = setInterval(() => {
        try {
          Context.current().heartbeat({ 
            status: 'png_variants:waiting', 
            current: i + 1,
            total: n,
            attempt: attempts,
            elapsedMs: Date.now() - startTime
          });
        } catch (err) {
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds
      
      try {
        // Use gpt-image-1 with transparent background support
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: imageConfig.model, // gpt-image-1 supports transparent
            prompt: enhancedPrompt,
            size: size,
            background: background,
            n: 1,
          }),
          signal: controller.signal as any,
        });
        
        clearTimeout(to);
        clearInterval(heartbeatInterval);
        
        if (!response.ok) {
          const errText = await response.text();
          const error = new Error(`Image API ${response.status}: ${errText}`);
          
          // Determine if retryable
          if (response.status === 429 || response.status >= 500) {
            console.log(`[PNG Variants] Retryable error: ${response.status}`);
            throw error; // Will retry
          } else {
            console.log(`[PNG Variants] Non-retryable error: ${response.status}`);
            throw ApplicationFailure.nonRetryable(error.message);
          }
        }
        
        const json = await response.json() as any;
        
        // Send heartbeat after response
        try {
          Context.current().heartbeat({ 
            status: 'png_variants:response_received', 
            current: i + 1,
            elapsedMs: Date.now() - startTime
          });
        } catch {}
        
        // Handle both URL and b64_json responses
        const firstData = json.data?.[0];
        const imageUrl = firstData?.url;
        const b64Data = firstData?.b64_json;
        
        let imageBuffer: Buffer;
        
        if (imageUrl) {
          console.log(`[PNG Variants] Downloading variant ${i + 1} from URL`);
          const imgResponse = await fetch(imageUrl);
          if (!imgResponse.ok) {
            throw new Error(`Failed to download image: ${imgResponse.status}`);
          }
          const arrayBuf = await imgResponse.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuf);
        } else if (b64Data) {
          console.log(`[PNG Variants] Decoding variant ${i + 1} from base64`);
          imageBuffer = Buffer.from(b64Data, 'base64');
        } else {
          throw new Error('Missing image URL or b64_json in response');
        }
        
        // Send heartbeat after download
        try {
          Context.current().heartbeat({ 
            status: 'png_variants:downloaded', 
            current: i + 1,
            size: imageBuffer.length
          });
        } catch {}
        
        return imageBuffer;
      } finally {
        clearTimeout(to);
        clearInterval(heartbeatInterval);
      }
    }, { 
      retries: imageConfig.retries, 
      initialBackoffMs: imageConfig.initialBackoffMs 
    });
    
    variants.push(buf);
    console.log(`[PNG Variants] Variant ${i + 1} completed (${buf.length} bytes)`);
  }
  
  const totalDuration = Date.now() - startTime;
  console.log(`[PNG Variants] All ${n} variants completed in ${Math.round(totalDuration / 1000)}s (${attempts} total attempts)`);
  
  // Final heartbeat
  try {
    Context.current().heartbeat({ 
      status: 'png_variants:complete', 
      count: variants.length,
      attempts,
      durationMs: totalDuration
    });
  } catch {}
  
  return { variants, attempts };
}

/**
 * Generate low-res character options (JPEG) for quick preview selection
 * Dev: 1 option; Prod: 3 options
 */
export async function generateLowResCharacterOptions(
  bookId: string,
  spec: { name: string; ageYears: number; looks: string; description: string; characterKind?: string; characterKindDetails?: string }
): Promise<{ files: string[] }> {
  const startTime = Date.now();
  const count = process.env.NODE_ENV !== 'production' ? 1 : 3;
  console.log(`[LowResCharacter] Generating ${count} low-res JPEG option(s) for ${spec.name}`);

  const characterDir = path.join(BOOKS_DIR, bookId, 'characters');
  const optionsDir = path.join(characterDir, 'options');
  await ensureDir(optionsDir);

  // Build simple prompt inline (reuse logic from lib/promptBuilder.ts)
  const safeLooks = spec.looks.replace(/[^\w\s,.-]/g, '').trim();
  const safeDesc = spec.description.replace(/[^\w\s,.-]/g, '').trim();
  const kind = (spec.characterKind || '').trim().toLowerCase();
  const details = (spec.characterKindDetails || '').trim();
  const NON_HUMAN = new Set(['dog','cat','fox','rabbit','bear','elephant','giraffe','lion','tiger','bird','dinosaur','dragon']);
  const subjectLine = kind
    ? `Subject: ${kind}.` + (NON_HUMAN.has(kind) ? ` Avoid depicting humans; focus on the named character type.` : '')
    : '';
  const detailsLine = details ? `Character details: ${details}.` : '';
  const prompt = [
    `Design a children's book character named "${spec.name}" (age ${spec.ageYears}).`,
    subjectLine,
    `Looks: ${safeLooks}. Personality/role: ${safeDesc}.`,
    detailsLine,
    `Style: friendly shapes, clean lines, clear silhouette, vibrant but balanced colors.`,
    `Safety: kid-appropriate, no weapons, no brands/logos, no embedded text.`,
    `Output: full-body on white background, low resolution.`
  ].filter(Boolean).join(' ');

  console.log(`[LowResCharacter] Using prompt: ${prompt.slice(0, 100)}...`);

  // Send initial heartbeat
  try {
    Context.current().heartbeat({ status: 'character_options:start', count });
  } catch {}

  const files: string[] = [];
  const apiKey = config.getApiKey();
  if (!apiKey) throw ApplicationFailure.nonRetryable('OPENAI_API_KEY not set');

  try {
    // Generate all options in one call
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        quality: 'low',
        n: count,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Image API ${response.status}: ${errText}`);
    }

    const json = await response.json() as any;

    // Download and save each option
    for (let i = 0; i < (json.data || []).length; i++) {
      const item = json.data[i];
      const imageUrl = item?.url;
      const b64 = item?.b64_json;

      let buf: Buffer;
      if (imageUrl) {
        console.log(`[LowResCharacter] Downloading option ${i + 1} from URL`);
        buf = await downloadImage(imageUrl);
      } else if (b64) {
        console.log(`[LowResCharacter] Decoding option ${i + 1} from base64`);
        buf = Buffer.from(b64, 'base64');
      } else {
        console.warn(`[LowResCharacter] Missing image data for option ${i + 1}`);
        continue;
      }

      // Convert to JPEG and save
      const fileName = `option-${String(i + 1).padStart(2, '0')}.jpg`;
      const filePath = path.join(optionsDir, fileName);
      
      const jpegBuf = await sharp(buf)
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
      
      await fs.writeFile(filePath, jpegBuf);
      files.push(fileName);
      console.log(`[LowResCharacter] Saved ${fileName} (${jpegBuf.length} bytes)`);

      // Heartbeat
      try {
        Context.current().heartbeat({ 
          status: 'character_options:progress', 
          current: i + 1, 
          total: count 
        });
      } catch {}
    }

    // Write manifest
    const manifest = {
      bookId,
      spec,
      files,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(optionsDir, 'options.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    const duration = Date.now() - startTime;
    console.log(`[LowResCharacter] Generated ${files.length} options in ${Math.round(duration / 1000)}s`);

    // Final heartbeat
    try {
      Context.current().heartbeat({ 
        status: 'character_options:done', 
        count: files.length,
        durationMs: duration
      });
    } catch {}

    // Derive and persist a light character bible for downstream use
    try {
      const fakeSpec = canonicalizeSpec({ name: spec.name, ageYears: spec.ageYears, looks: spec.looks, description: spec.description });
      const bible = deriveCharacterBibleEntry(fakeSpec, undefined, { looks: spec.looks, description: spec.description });
      const biblePath = path.join(characterDir, 'character.json');
      await fs.writeFile(biblePath, JSON.stringify(bible, null, 2), 'utf8');
    } catch {}

    return { files };
  } catch (e: any) {
    console.error(`[LowResCharacter] Generation failed:`, e.message);
    await writeErrorLog(bookId, `low-res character options failed: ${e.message}`);
    
    // Fallback: create placeholder if allowed
    if (config.features.allowPlaceholder) {
      for (let i = 1; i <= count; i++) {
        const fileName = `option-${String(i).padStart(2, '0')}.jpg`;
        const filePath = path.join(optionsDir, fileName);
        await createPlaceholderPng(filePath, `Character ${i}`, '1024x1024');
        files.push(fileName);
      }
      return { files };
    }
    
    throw e;
  }
}

// --- Critic: optional review pass for pages ---
export async function critiquePageText(
  bookId: string,
  page: PageJSON,
  prefs: BookPrefs,
): Promise<{ approved: boolean; issues: string[]; suggestion: string }> {
  const model = config.models.critic;
  const temperature = config.temperatures.critic;

  try {
    const result: any = await runStructuredPrompt({
      bookId,
      step: `critic-page-${page.pageIndex}`,
      version: CRITIC_PROMPT_VERSION,
      model,
      temperature,
      system: buildCriticSystem(prefs),
      user: buildCriticUser(page, prefs),
    });
    return {
      approved: result?.approved === true,
      issues: Array.isArray(result?.issues) ? result.issues : [],
      suggestion: typeof result?.suggestion === 'string' ? result.suggestion : '',
    };
  } catch {
    // On error, approve by default
    return { approved: true, issues: [], suggestion: '' };
  }
}
