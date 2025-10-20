#!/usr/bin/env node
/**
 * CLI Test Script for Border Effects
 * 
 * Tests all border effect styles on a PNG image without using OpenAI tokens
 * 
 * Usage:
 *   npx tsx temporal/scripts/test-border-effects.ts --url "https://example.com/image.png"
 *   npx tsx temporal/scripts/test-border-effects.ts --file "./test.png"
 *   npx tsx temporal/scripts/test-border-effects.ts --file "./test.png" --width 1600 --height 900
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import {
  applyBorderEffect,
  getDefaultBorderConfig,
  BorderEffectType,
} from '../lib/border-effects.js';

interface TestOptions {
  imageSource: string;
  isUrl: boolean;
  canvasWidth: number;
  canvasHeight: number;
  outputDir: string;
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        if (response.headers.location) {
          downloadImage(response.headers.location).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Load image from file or URL
 */
async function loadImage(source: string, isUrl: boolean): Promise<Buffer> {
  if (isUrl) {
    console.log(`📥 Downloading image from: ${source}`);
    return downloadImage(source);
  } else {
    console.log(`📂 Loading image from: ${source}`);
    return fs.readFile(source);
  }
}

/**
 * Apply border effect and compose with text on a page
 */
async function composePage(
  illustrationBuffer: Buffer,
  borderType: BorderEffectType,
  canvasWidth: number,
  canvasHeight: number,
  sampleText: string = "Once upon a time, in a magical forest, there lived a curious fox who loved to explore."
): Promise<Buffer> {
  // Define layout (similar to your book page layout)
  const margin = Math.floor(canvasWidth * 0.05);
  const illustrationHeight = Math.floor(canvasHeight * 0.65);
  const illustrationWidth = canvasWidth - margin * 2;

  // Create white canvas
  const canvas = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: '#ffffff',
    },
  }).png().toBuffer();

  // Prepare illustration to fit
  const resizedIllustration = await sharp(illustrationBuffer)
    .resize(illustrationWidth, illustrationHeight, {
      fit: 'inside',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .toBuffer();

  // Apply border effect to the illustration
  const config = getDefaultBorderConfig(borderType);
  const borderResult = await applyBorderEffect(resizedIllustration, config);

  // Get illustration dimensions after resize
  const illustrationMeta = await sharp(borderResult.illustrationBuffer).metadata();
  const actualWidth = illustrationMeta.width || illustrationWidth;
  const actualHeight = illustrationMeta.height || illustrationHeight;
  
  // Center the illustration
  const illustrationX = margin + Math.floor((illustrationWidth - actualWidth) / 2);
  const illustrationY = margin + Math.floor((illustrationHeight - actualHeight) / 2);

  // Compose layers
  const layers: sharp.OverlayOptions[] = [];

  // Add shadow layer first (if exists) - goes behind illustration
  if (borderResult.shadowLayer) {
    const shadowX = illustrationX + (borderResult.shadowLayer.offsetX || 0);
    const shadowY = illustrationY + (borderResult.shadowLayer.offsetY || 0);
    layers.push({
      input: borderResult.shadowLayer.buffer,
      left: shadowX,
      top: shadowY,
      blend: 'over',
    });
  }

  // Add illustration with border effect applied
  layers.push({
    input: borderResult.illustrationBuffer,
    left: illustrationX,
    top: illustrationY,
  });

  // Add text overlay
  const textY = margin + illustrationHeight + Math.floor(margin * 0.8);
  const textHeight = canvasHeight - textY - margin;
  const textSvg = `<svg width="${canvasWidth}" height="${canvasHeight}">
    <foreignObject x="${margin}" y="${textY}" width="${canvasWidth - margin * 2}" height="${textHeight}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: ${Math.floor(canvasWidth * 0.018)}px; color: #333; line-height: 1.6; text-align: center;">
        ${sampleText}
      </div>
    </foreignObject>
  </svg>`;

  const textBuffer = await sharp(Buffer.from(textSvg)).png().toBuffer();
  layers.push({
    input: textBuffer,
    left: 0,
    top: 0,
  });

  // Final composition
  return sharp(canvas).composite(layers).jpeg({ quality: 90 }).toBuffer();
}

/**
 * Main test function
 */
async function runTest(options: TestOptions): Promise<void> {
  console.log('\n🎨 Border Effects Test Script\n');
  console.log(`Canvas: ${options.canvasWidth}x${options.canvasHeight}`);
  console.log(`Output: ${options.outputDir}\n`);

  // Load source image
  const sourceBuffer = await loadImage(options.imageSource, options.isUrl);
  console.log('✅ Image loaded successfully\n');

  // Create output directory
  await fs.mkdir(options.outputDir, { recursive: true });

  // Test all border effects
  const borderTypes: BorderEffectType[] = [
    'none',
    'professionalFrame',
    'paintedEdge',
    'modernCard',
    'vintageFrame',
    'storybookCorners',
    'softVignette',
    'photoMatte',
    'tornPaper',
    'polaroid',
    'sketchDrawn',
    'comicBook',
    'neonGlow',
    'filmStrip',
  ];

  console.log('🖼️  Generating previews...\n');

  for (const borderType of borderTypes) {
    console.log(`   Processing: ${borderType}...`);
    
    const jpegBuffer = await composePage(
      sourceBuffer,
      borderType,
      options.canvasWidth,
      options.canvasHeight
    );

    const outputPath = path.join(options.outputDir, `${borderType}.jpg`);
    await fs.writeFile(outputPath, jpegBuffer);
    
    console.log(`   ✓ Saved: ${outputPath}`);
  }

  console.log('\n✨ Done! Check the output directory for results.\n');
  console.log(`📁 Output directory: ${path.resolve(options.outputDir)}\n`);
}

/**
 * Parse CLI arguments
 */
function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  
  let imageSource: string | null = null;
  let isUrl = false;
  let canvasWidth = 1600;
  let canvasHeight = 900;
  let outputDir = './border-test-output';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--url':
        imageSource = args[++i];
        isUrl = true;
        break;
      case '--file':
        imageSource = args[++i];
        isUrl = false;
        break;
      case '--width':
        canvasWidth = parseInt(args[++i], 10);
        break;
      case '--height':
        canvasHeight = parseInt(args[++i], 10);
        break;
      case '--output':
      case '-o':
        outputDir = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Border Effects Test Script

Usage:
  npx tsx temporal/scripts/test-border-effects.ts [options]

Options:
  --url <url>           PNG image URL to test
  --file <path>         Local PNG file path to test
  --width <pixels>      Canvas width (default: 1600)
  --height <pixels>     Canvas height (default: 900)
  --output <dir>        Output directory (default: ./border-test-output)
  -o <dir>              Short form of --output
  --help, -h            Show this help

Examples:
  npx tsx temporal/scripts/test-border-effects.ts --url "https://example.com/image.png"
  npx tsx temporal/scripts/test-border-effects.ts --file "./my-image.png"
  npx tsx temporal/scripts/test-border-effects.ts --file "./test.png" --width 2400 --height 1350
  npx tsx temporal/scripts/test-border-effects.ts --file "./test.png" -o ./my-results

Border Styles Generated:
  • none                - No border (baseline)
  • professionalFrame   - Clean border with subtle shadow
  • paintedEdge        - Watercolor brush stroke edges
  • modernCard         - Rounded corners with soft shadow
  • vintageFrame       - Ornate aged frame
  • storybookCorners   - Decorative corner flourishes
        `);
        process.exit(0);
        break;
    }
  }

  if (!imageSource) {
    console.error('Error: Please provide an image source with --url or --file\n');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  return {
    imageSource,
    isUrl,
    canvasWidth,
    canvasHeight,
    outputDir,
  };
}

/**
 * Run the script
 */
async function main() {
  try {
    const options = parseArgs();
    await runTest(options);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

