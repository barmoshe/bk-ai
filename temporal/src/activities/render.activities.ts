import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import { PageJSON, PrintSpec, PageLayoutPlan, PageStyleAdvice, BookStyleAdvice, BackgroundSpec } from '../types';
import { imageConfig, config } from '../shared';
import { LayoutMeta } from '../lib/layout';
import { saveComposedPage } from '../lib/imageIO';
import { createRenderPipeline } from '../lib/render-pipeline';
import { adviseBookStyle, advisePageStyle } from '../lib/styleAdvisor';
import { PrintProfile, PRINT_PROFILES, getPrintProfile } from '../config/print-profiles';
import { TypographyConfig, FONT_STACKS } from '../lib/typography';
import { getFontStackForStylePack } from '../lib/styleFonts';
import { buildEmbeddedCssFromStack } from '../lib/fontEmbed';
import { optimalFontSize } from '../lib/layout-grid';
import { savePageRender, ensurePageDirectories } from '../lib/fileSystem';

const BOOKS_DIR = config.booksDataDir;

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function renderPageJPEG(
  bookId: string,
  page: PageJSON,
  pngPath: string,
): Promise<string> {
  // Legacy quick render target; enforce 16:9 landscape
  const width = 1600;
  const height = 900;
  const pageDir = path.join(BOOKS_DIR, bookId, 'pages', String(page.pageIndex));
  await fs.mkdir(pageDir, { recursive: true });
  const outPath = path.join(pageDir, 'page.jpg');

  const base = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
  const illustration = await sharp(pngPath).resize(Math.round(width * 0.52), Math.round(height * 0.7), { fit: 'inside' }).toBuffer();
  const textY = page.layout === 'imageTop' ? Math.round(height * 0.64) : Math.round(height * 0.18);
  const imageLeft = page.layout === 'imageLeft' ? Math.round(width * 0.04) : page.layout === 'imageRight' ? Math.round(width * 0.52) : Math.round(width * 0.1);
  const imageTop = page.layout === 'imageTop' ? Math.round(height * 0.05) : Math.round(height * 0.12);

  const previewText = (page.formatted?.lines && page.formatted.lines.length)
    ? page.formatted.lines.join('\n')
    : page.text;
  // Use mapped font family for preview; lock size to 32px for screen preview
  const stack = getFontStackForStylePack('storybook_watercolor');
  const previewFamily = stack.bodyFamily || "Inter, Helvetica Neue, Arial, sans-serif";
  const textSvg = `<svg width="${width}" height="${height}">
  <style> .t { font: 32px ${previewFamily}; fill: #222; } </style>
  <foreignObject x="${Math.round(width * 0.04)}" y="${textY}" width="${Math.round(width * 0.92)}" height="${height - textY - Math.round(height * 0.04)}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: ${previewFamily}; font-size: 32px; color: #222; line-height: 1.3; white-space: pre-wrap;">${escapeXml(previewText)}</div>
  </foreignObject>
</svg>`;

  await sharp(base)
    .composite([
      { input: illustration, left: imageLeft, top: imageTop },
      { input: Buffer.from(textSvg), left: 0, top: 0 },
    ])
    .jpeg({ quality: 85 })
    .toFile(outPath);

  return outPath;
}

function inchesToPixels(inches: number, dpi: number): number {
  return Math.round(inches * dpi);
}

function wrapTextToLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const tentative = current ? current + ' ' + word : word;
    if (tentative.length <= maxCharsPerLine) {
      current = tentative;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  // If overflow, add ellipsis to last line
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length > 1 ? last.slice(0, Math.max(0, maxCharsPerLine - 1)) + '…' : '…';
  }
  return lines;
}

function buildTextSvg(
  txt: string,
  pageWidth: number,
  pageHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  textAlign: 'left' | 'center',
  preformattedLines?: string[],
): string {
  let lines: string[];
  if (preformattedLines && preformattedLines.length > 0) {
    // Fit to box by reducing font size if needed (basic approach for legacy path)
    const maxLines = Math.max(1, Math.floor(height / Math.round(fontSize * lineHeight)));
    if (preformattedLines.length > maxLines) {
      // Reduce font size iteratively until it fits or reach minimum
      let effective = fontSize;
      let iterations = 0;
      while (preformattedLines.length * Math.round(effective * lineHeight) > height && iterations < 10 && effective > 12) {
        effective = Math.floor(effective * 0.9);
        iterations++;
      }
      fontSize = effective;
    }
    lines = preformattedLines;
  } else {
    const approxCharsPerLine = Math.max(10, Math.floor(width / (fontSize * 0.6)));
    const maxLines = Math.max(1, Math.floor(height / Math.round(fontSize * lineHeight)));
    lines = wrapTextToLines(txt, approxCharsPerLine, maxLines);
  }

  const anchor = textAlign === 'center' ? 'middle' : 'start';
  const baseX = textAlign === 'center' ? x + Math.floor(width / 2) : x;
  const baseY = y + Math.round(fontSize); // start at first baseline

  const tspans = lines
    .map((line, i) => `<tspan x="${baseX}" dy="${i === 0 ? 0 : Math.round(fontSize * lineHeight)}">${escapeXml(line)}</tspan>`) 
    .join('');

  return `<svg width="${pageWidth}" height="${pageHeight}">
    <g>
      <text x="${baseX}" y="${baseY}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${fontSize}" fill="#222">${tspans}</text>
    </g>
  </svg>`;
}

export async function renderPageJPEGPrint(
  bookId: string,
  page: PageJSON,
  pngPath: string,
  print: PrintSpec,
  layout: PageLayoutPlan,
): Promise<string> {
  const widthPx = inchesToPixels(print.widthIn + 2 * print.bleedIn, print.dpi);
  const heightPx = inchesToPixels(print.heightIn + 2 * print.bleedIn, print.dpi);
  const pageDir = path.join(BOOKS_DIR, bookId, 'pages', String(page.pageIndex));
  await fs.mkdir(pageDir, { recursive: true });
  const outPath = path.join(pageDir, 'page-print.jpg');

  // Base canvas
  let base = sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: '#ffffff' } })
    .png();

  // Prepare illustration to fit inside layout.illustrationRect
  let illustration = sharp(pngPath)
    .resize(layout.illustrationRect.width, layout.illustrationRect.height, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
    .sharpen(0.5)
    .toBuffer();

  // Optional background card behind text
  let cardSvg = '';
  if (layout.backgroundCard) {
    const r = layout.backgroundCard;
    const x = layout.textRect.x - r.paddingPx;
    const y = layout.textRect.y - r.paddingPx;
    const w = layout.textRect.width + r.paddingPx * 2;
    const h = layout.textRect.height + r.paddingPx * 2;
    const shadow = r.shadow
      ? `<filter id="f1" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000055"/></filter>`
      : '';
    const filter = r.shadow ? 'filter="url(#f1)"' : '';
    cardSvg = `<svg width="${widthPx}" height="${heightPx}">
      ${shadow}
      <rect x="${x}" y="${y}" rx="${r.radiusPx}" ry="${r.radiusPx}" width="${w}" height="${h}" fill="#ffffff" ${filter} />
    </svg>`;
  }

  // Text SVG using <text>/<tspan> (foreignObject is not reliably supported in sharp)
  const manifestPath = path.join(BOOKS_DIR, bookId, 'manifest.json');
  let stylePackId: string | undefined = undefined;
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const man = JSON.parse(raw);
    stylePackId = man?.stylePackId;
  } catch {}
  const stack = getFontStackForStylePack(stylePackId);
  const embeddedCss = await buildEmbeddedCssFromStack(stack);
  const fontFamily = layout.fontFamily ?? stack.bodyFamily ?? 'Inter, Helvetica Neue, Arial, sans-serif';
  const fontSize = layout.fontSizePx ?? Math.max(28, Math.round(layout.textRect.width * 0.03));
  const lineHeight = layout.lineHeight ?? 1.3;
  const textAlign = layout.textAlign ?? 'left';
  // Respect locked font size; allow micro-shrink up to 5% only if forced lines overflow, handled inside buildTextSvg by adjusting preformatted lines
  const textSvgCore = buildTextSvg(
    page.text,
    widthPx,
    heightPx,
    layout.textRect.x,
    layout.textRect.y,
    layout.textRect.width,
    layout.textRect.height,
    fontFamily,
    fontSize,
    lineHeight,
    textAlign,
    page.formatted?.lines,
  );
  const textSvg = embeddedCss
    ? `<svg width="${widthPx}" height="${heightPx}"><style>${embeddedCss}</style>${textSvgCore}</svg>`
    : textSvgCore;

  const composites: sharp.OverlayOptions[] = [];
  if (cardSvg) composites.push({ input: Buffer.from(cardSvg), left: 0, top: 0 });
  composites.push({ input: await illustration, left: layout.illustrationRect.x, top: layout.illustrationRect.y });
  composites.push({ input: Buffer.from(textSvg), left: 0, top: 0 });

  let pipeline = sharp(await base.toBuffer())
    .composite(composites)
    .withMetadata({ density: print.dpi });

  if (print.iccProfilePath) {
    try {
      const prof = await fs.readFile(print.iccProfilePath);
      pipeline = pipeline.withMetadata({ icc: prof, density: print.dpi } as any);
    } catch {
      // ignore ICC errors, proceed with default sRGB
    }
  }

  const jpegQuality = Math.max(70, Math.min(100, print.jpegQuality ?? 94));
  const chroma = print.chromaSubsampling ?? '4:4:4';
  await pipeline
    .jpeg({ quality: jpegQuality, chromaSubsampling: chroma, mozjpeg: true })
    .toFile(outPath);

  return outPath;
}

// --- New: Compose final page JPEG using hybrid engine ---
async function renderTextCanvas(text: string, ta: LayoutMeta['textArea']): Promise<Buffer> {
  // For portability, render text via SVG if canvas is unavailable in env
  const lineHeightPx = Math.round(ta.size * ta.lineHeight);
  const x = 0; const y = 0; const w = ta.w; const h = ta.h;
  const svg = `<svg width="${w}" height="${h}">
    <style>
      .t { font: ${ta.weight} ${ta.size}px ${ta.font}; fill: #222; }
    </style>
    <foreignObject x="0" y="0" width="${w}" height="${h}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${ta.font}; font-weight:${ta.weight}; font-size:${ta.size}px; line-height:${ta.lineHeight}; color:#222; white-space:pre-wrap;">
        ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}
      </div>
    </foreignObject>
  </svg>`;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

export async function composePage(args: {
  layout: LayoutMeta;
  text: string;
  characterPng: Buffer;
  decor1Png: Buffer;
  decor2Png: Buffer;
  pageId?: string;
}): Promise<Buffer> {
  const { width, height } = imageConfig.canvas;
  let background = '#ffffff';
  const base = await sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
  const textPng = await renderTextCanvas(args.text, args.layout.textArea);
  const layers: sharp.OverlayOptions[] = [
    { input: args.characterPng, left: args.layout.positions.character.x, top: args.layout.positions.character.y },
    { input: args.decor1Png, left: args.layout.positions.decor1.x, top: args.layout.positions.decor1.y },
    { input: args.decor2Png, left: args.layout.positions.decor2.x, top: args.layout.positions.decor2.y },
    { input: textPng, left: args.layout.textArea.x, top: args.layout.textArea.y },
  ];
  const jpeg = await sharp(base)
    .composite(layers)
    .jpeg({ quality: imageConfig.jpegQuality, progressive: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
  if (args.pageId) {
    await saveComposedPage(args.pageId, jpeg, { layout: args.layout });
  }
  return jpeg;
}

// ============================================================================
// PROFESSIONAL RENDERING PIPELINE (New implementation)
// ============================================================================

/**
 * Render page using professional pipeline with multiple output profiles
 */
export async function renderPageProfessional(
  bookId: string,
  page: PageJSON,
  pngPath: string,
  print: PrintSpec,
  layout: PageLayoutPlan,
  profiles: Array<'screen' | 'proof' | 'print'> = ['print']
): Promise<Record<string, string>> {
  const outputs: Record<string, string> = {};

  // Read illustration once
  const illustrationBuffer = await fs.readFile(pngPath);

  // Calculate dimensions
  const inchesToPixels = (inches: number, dpi: number) => Math.round(inches * dpi);
  const bleedPx = inchesToPixels(print.bleedIn, print.dpi);
  const marginsPx = {
    top: inchesToPixels(print.marginsIn.top, print.dpi),
    right: inchesToPixels(print.marginsIn.right, print.dpi),
    bottom: inchesToPixels(print.marginsIn.bottom, print.dpi),
    left: inchesToPixels(print.marginsIn.left, print.dpi),
  };

  // Typography configuration
  const fontSize = layout.fontSizePx ?? optimalFontSize(layout.textRect.width);
  const typographyConfig: TypographyConfig = {
    fontFamily: layout.fontFamily ?? FONT_STACKS.body,
    fontSize,
    fontWeight: 400,
    lineHeight: layout.lineHeight ?? 1.3,
    textAlign: layout.textAlign ?? 'left',
    color: '#222222',
  };

  // Load page-level or book-level style advice (best-effort)
  let pageAdvice: PageStyleAdvice | null = null;
  let bookAdvice: BookStyleAdvice | null = null;
  try {
    const p = path.join(BOOKS_DIR, bookId, 'pages', String(page.pageIndex), 'style.json');
    const raw = await fs.readFile(p, 'utf8');
    pageAdvice = JSON.parse(raw);
  } catch {}
  try {
    const b = path.join(BOOKS_DIR, bookId, 'style.json');
    const raw = await fs.readFile(b, 'utf8');
    bookAdvice = JSON.parse(raw);
  } catch {}
  // If missing, compute and persist via advisor (best-effort)
  try {
    if (!bookAdvice) {
      const manifestRaw = await fs.readFile(path.join(BOOKS_DIR, bookId, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestRaw);
      bookAdvice = await adviseBookStyle(bookId, manifest.prefs);
    }
  } catch {}
  try {
    if (!pageAdvice) {
      const manifestRaw = await fs.readFile(path.join(BOOKS_DIR, bookId, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestRaw);
      pageAdvice = await advisePageStyle(bookId, page, manifest.prefs);
    }
  } catch {}
  const effectiveBackground: BackgroundSpec | undefined = pageAdvice?.background || bookAdvice?.background;
  const saturationBoost = typeof pageAdvice?.saturationBoost === 'number' ? pageAdvice!.saturationBoost : undefined;

  // Render for each profile
  for (const profileType of profiles) {
    const profile = getPrintProfile(profileType);
    const widthPx = inchesToPixels(print.widthIn + 2 * print.bleedIn, profile.dpi);
    const heightPx = inchesToPixels(print.heightIn + 2 * print.bleedIn, profile.dpi);

    // Create rendering pipeline
    const pipeline = createRenderPipeline(widthPx, heightPx, bleedPx, marginsPx, profile);

    // Render page
    const jpegBuffer = await pipeline.renderPage({
      text: page.text,
      illustrationBuffer,
      layoutStyle: (pageAdvice?.layoutStyle as any) || layout.style,
      typographyConfig,
      backgroundColor: '#ffffff',
      backgroundSpec: effectiveBackground,
      saturationBoost,
      forcedLines: page.formatted?.lines,
    });

    // Save to unified file system
    const outputPath = await savePageRender(bookId, page.pageIndex, profileType, jpegBuffer);
    // Maintain backward-compatible path for PDF route
    if (profileType === 'print') {
      try {
        const legacyOut = path.join(BOOKS_DIR, bookId, 'pages', String(page.pageIndex), 'page-print.jpg');
        await fs.mkdir(path.dirname(legacyOut), { recursive: true });
        await fs.writeFile(legacyOut, jpegBuffer);
      } catch {}
    }
    outputs[profileType] = outputPath;
  }

  return outputs;
}

/**
 * Enhanced print rendering with better quality controls
 * This is a drop-in replacement for renderPageJPEGPrint
 */
export async function renderPageJPEGPrintEnhanced(
  bookId: string,
  page: PageJSON,
  pngPath: string,
  print: PrintSpec,
  layout: PageLayoutPlan,
  profileId: string = 'printOffice'
): Promise<string> {
  await ensurePageDirectories(bookId, page.pageIndex);

  const profile = getPrintProfile(profileId);
  const illustrationBuffer = await fs.readFile(pngPath);

  // Calculate dimensions
  const inchesToPixels = (inches: number, dpi: number) => Math.round(inches * dpi);
  const widthPx = inchesToPixels(print.widthIn + 2 * print.bleedIn, profile.dpi);
  const heightPx = inchesToPixels(print.heightIn + 2 * print.bleedIn, profile.dpi);
  const bleedPx = inchesToPixels(print.bleedIn, profile.dpi);
  const marginsPx = {
    top: inchesToPixels(print.marginsIn.top, profile.dpi),
    right: inchesToPixels(print.marginsIn.right, profile.dpi),
    bottom: inchesToPixels(print.marginsIn.bottom, profile.dpi),
    left: inchesToPixels(print.marginsIn.left, profile.dpi),
  };

  // Typography configuration
  const fontSize = layout.fontSizePx ?? optimalFontSize(layout.textRect.width);
  const typographyConfig: TypographyConfig = {
    fontFamily: layout.fontFamily ?? FONT_STACKS.body,
    fontSize,
    fontWeight: 400,
    lineHeight: layout.lineHeight ?? 1.3,
    textAlign: layout.textAlign ?? 'left',
    color: '#222222',
  };

  // Create rendering pipeline
  const pipeline = createRenderPipeline(widthPx, heightPx, bleedPx, marginsPx, profile);

  // Render page
  const jpegBuffer = await pipeline.renderPage({
    text: page.text,
    illustrationBuffer,
    layoutStyle: layout.style,
    typographyConfig,
    backgroundColor: '#ffffff',
    forcedLines: page.formatted?.lines,
  });

  // Save to legacy path for backward compatibility
  const pageDir = path.join(BOOKS_DIR, bookId, 'pages', String(page.pageIndex));
  await fs.mkdir(pageDir, { recursive: true });
  const outPath = path.join(pageDir, 'page-print.jpg');
  await fs.writeFile(outPath, jpegBuffer);

  return outPath;
}


