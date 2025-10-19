import { buildPrompt } from '../lib/promptComposer';
import { getStylePack, StylePackId } from '../lib/stylePacks';
import { imageConfig } from '../shared';
import { cleanPng, hashString, saveGeneratedAsset } from '../lib/imageIO';
import { generatePngVariants } from './openai.activities';
import { buildLayoutMetadata } from '../lib/layout';
import { composePage } from './render.activities';
import { promises as fs } from 'fs';
import path from 'path';

type Subjects = { character: string; decor1: string; decor2: string };

export interface GeneratePageAssetsArgs {
  pageId: string;
  text: string;
  stylePackId: StylePackId;
  subjects: Subjects;
  variants?: number;
  force?: boolean;
}

export interface GeneratePageAssetsResult {
  pagePath: string;
  metaPath: string;
  assetIds: { character: string; decor1: string; decor2: string };
  cacheHit: boolean;
}

export async function generatePageAssetsActivity(args: GeneratePageAssetsArgs): Promise<GeneratePageAssetsResult> {
  const variants = Math.max(2, Math.min(4, args.variants ?? imageConfig.variants));
  const stylePack = getStylePack(args.stylePackId);
  const textHash = hashString(args.text);
  const canvasKey = `${imageConfig.canvas.width}x${imageConfig.canvas.height}`;
  const idKey = hashString(JSON.stringify({ stylePack: args.stylePackId, textHash, canvasKey, subjects: args.subjects }));

  // Cache check: if composed page exists and force not set, return quickly
  const pageDir = path.join(imageConfig.generatedDir, 'pages', args.pageId);
  const pagePath = path.join(pageDir, 'page.jpg');
  try {
    if (!args.force) {
      await fs.access(pagePath);
      const metaPath = path.join(pageDir, 'meta.json');
      return { pagePath, metaPath, assetIds: { character: `${idKey}-character`, decor1: `${idKey}-decor1`, decor2: `${idKey}-decor2` }, cacheHit: true };
    }
  } catch {}

  // Build prompts
  const pCharacter = buildPrompt({ category: args.subjects.character, stylePackId: args.stylePackId });
  const pDecor1 = buildPrompt({ category: args.subjects.decor1, stylePackId: args.stylePackId });
  const pDecor2 = buildPrompt({ category: args.subjects.decor2, stylePackId: args.stylePackId });

  const ids = { character: `${idKey}-character`, decor1: `${idKey}-decor1`, decor2: `${idKey}-decor2` };

  // Generate variants for each subject and select first (simple selection; human-in-loop optional later)
  const genCharacter = await generatePngVariants({ prompt: pCharacter.prompt, n: variants, size: imageConfig.objectPng.size, background: 'transparent' });
  const genDecor1 = await generatePngVariants({ prompt: pDecor1.prompt, n: variants, size: imageConfig.objectPng.size, background: 'transparent' });
  const genDecor2 = await generatePngVariants({ prompt: pDecor2.prompt, n: variants, size: imageConfig.objectPng.size, background: 'transparent' });

  // Post-process: trim + defringe + alpha validation
  const characterClean = await cleanPng(genCharacter.variants[0]);
  const decor1Clean = await cleanPng(genDecor1.variants[0]);
  const decor2Clean = await cleanPng(genDecor2.variants[0]);

  // Save raw (selected) and clean, plus meta
  await saveGeneratedAsset('raw', ids.character, genCharacter.variants[0]);
  await saveGeneratedAsset('raw', ids.decor1, genDecor1.variants[0]);
  await saveGeneratedAsset('raw', ids.decor2, genDecor2.variants[0]);
  const charCleanPath = await saveGeneratedAsset('clean', ids.character, characterClean);
  const decor1CleanPath = await saveGeneratedAsset('clean', ids.decor1, decor1Clean);
  const decor2CleanPath = await saveGeneratedAsset('clean', ids.decor2, decor2Clean);
  const meta = {
    idKey,
    model: imageConfig.model,
    size: imageConfig.objectPng.size,
    stylePack: stylePack.id,
    prompts: {
      character: pCharacter,
      decor1: pDecor1,
      decor2: pDecor2,
    },
    attempts: { character: genCharacter.attempts, decor1: genDecor1.attempts, decor2: genDecor2.attempts },
    timings: {},
  };
  await saveGeneratedAsset('meta', ids.character, meta);
  await saveGeneratedAsset('meta', ids.decor1, meta);
  await saveGeneratedAsset('meta', ids.decor2, meta);

  // Build layout metadata
  const layout = buildLayoutMetadata({ text: args.text, stylePackId: stylePack.id, palette: stylePack.palette, seed: idKey });

  // Compose page
  await composePage({
    layout,
    text: args.text,
    characterPng: await fs.readFile(charCleanPath),
    decor1Png: await fs.readFile(decor1CleanPath),
    decor2Png: await fs.readFile(decor2CleanPath),
    pageId: args.pageId,
  });

  // Save composed (composePage already writes meta)
  const finalPath = path.join(imageConfig.generatedDir, 'pages', args.pageId, 'page.jpg');
  const metaPath = path.join(imageConfig.generatedDir, 'pages', args.pageId, 'meta.json');

  return { pagePath: finalPath, metaPath, assetIds: ids, cacheHit: false };
}


