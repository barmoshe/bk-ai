import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { imageConfig } from '../shared';

export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Clean and optimize PNG with transparent background
 * - Trims excess transparent space
 * - Smooths alpha channel edges
 * - Validates transparency
 * - Removes color fringing
 */
export async function cleanPng(input: Buffer): Promise<Buffer> {
  // Step 1: Trim excess transparent pixels (with threshold for safety)
  const trimmed = await sharp(input)
    .trim({ threshold: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  
  // Step 2: Extract and enhance alpha channel
  const { data: alpha, info } = await sharp(trimmed)
    .ensureAlpha()
    .extractChannel('alpha')
    .blur(0.8) // Smooth edges for better anti-aliasing
    .normalize() // Enhance alpha channel contrast
    .raw() // IMPORTANT: output raw pixels so joinChannel raw descriptor matches
    .toBuffer({ resolveWithObject: true });
  
  // Step 3: Remove color fringing (common issue with transparent PNGs)
  // Multiply colors by alpha to remove edge artifacts
  const defringed = await sharp(trimmed)
    .ensureAlpha()
    .removeAlpha() // Get RGB channels
    .composite([{
      input: trimmed, // Original with alpha
      blend: 'dest-in', // Use alpha as mask
    }])
    .toBuffer();
  
  // Step 4: Recompose with cleaned alpha channel
  const recomposed = await sharp(defringed)
    .ensureAlpha()
    .joinChannel(alpha, { 
      raw: { 
        width: info.width, 
        height: info.height, 
        channels: 1 
      } 
    })
    .png({
      compressionLevel: 9, // Maximum compression
      adaptiveFiltering: true, // Better compression
      palette: false, // Keep full color depth
    })
    .toBuffer();
  
  // Step 5: Validate transparency
  const stats = await sharp(recomposed).stats();
  const alphaChannel = stats.channels[3];
  
  if (!alphaChannel) {
    throw new Error('AlphaMissing: PNG does not have alpha channel');
  }
  
  if (alphaChannel.min === 255 && alphaChannel.max === 255) {
    throw new Error('AlphaOpaque: PNG alpha channel is fully opaque (no transparency)');
  }
  
  // Ensure there's actual transparency (not just theoretical)
  if (alphaChannel.min >= 250) {
    throw new Error('AlphaIneffective: PNG has insufficient transparency');
  }
  
  console.log(`[Clean PNG] Alpha range: ${alphaChannel.min}-${alphaChannel.max}, size: ${info.width}x${info.height}`);
  
  return recomposed;
}

export async function saveGeneratedAsset(kind: 'raw' | 'clean' | 'meta', id: string, data: Buffer | object) {
  const base = imageConfig.generatedDir;
  const dir =
    kind === 'meta'
      ? path.join(base, 'meta')
      : path.join(base, kind);
  await ensureDir(dir);
  const file = path.join(dir, `${id}.${kind === 'meta' ? 'json' : 'png'}`);
  if (kind === 'meta') {
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  } else {
    await fs.writeFile(file, data as Buffer);
  }
  return file;
}

export async function saveComposedPage(pageId: string, jpeg: Buffer, meta: object, scale: 1 | 2 = 1) {
  const base = imageConfig.generatedDir;
  const dir = path.join(base, 'pages', pageId);
  await ensureDir(dir);
  const suffix = scale === 2 ? '@2x' : '';
  const file = path.join(dir, `page${suffix}.jpg`);
  await fs.writeFile(file, jpeg);
  const metaPath = path.join(dir, 'meta.json');
  let existing: any = {};
  try {
    existing = JSON.parse(await fs.readFile(metaPath, 'utf8'));
  } catch {}
  await fs.writeFile(metaPath, JSON.stringify({ ...existing, ...meta }, null, 2), 'utf8');
  return file;
}


