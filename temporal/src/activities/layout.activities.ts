import OpenAI from 'openai';
import {
  CharacterSpec,
  BookPrefs,
  PageJSON,
  PrintSpec,
  PageLayoutPlan,
  Rect,
  LayoutStyle,
} from '../types';
import { buildLayoutMetadata, LayoutMeta } from '../lib/layout';
import { runStructuredPrompt } from '../lib/promptRunner';
import { buildSystem as buildLayoutSystem, buildUser as buildLayoutUser, LAYOUT_PROMPT_VERSION } from '../lib/prompts/layout.prompt';
import { promises as fs } from 'fs';
import path from 'path';
import { config as shared } from '../shared';
import { config } from '../shared';
import { 
  snapToGrid, 
  calculateSafeZones, 
  calculateGutter, 
  optimalFontSize,
  goldenRatio
} from '../lib/layout-grid';
import { getFontStackForStylePack } from '../lib/styleFonts';

let client: OpenAI | undefined;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: config.getApiKey() });
  }
  return client;
}

function round(n: number): number {
  return Math.round(n);
}

function inchesToPixels(inches: number, dpi: number): number {
  return round(inches * dpi);
}

  /**
 * Professional layout computation using design grid system
 * Replaces magic numbers with consistent design principles
 */
function computeRects(
  style: LayoutStyle,
  pagePx: { width: number; height: number; bleedPx: number },
  marginsPx: { top: number; right: number; bottom: number; left: number },
): {
  illustrationRect: Rect;
  textRect: Rect;
  backgroundCard?: { radiusPx: number; paddingPx: number; shadow?: boolean };
} {
  // Calculate safe zones using professional grid system
  const safeZones = calculateSafeZones(pagePx.width, pagePx.height, pagePx.bleedPx, marginsPx);
  const safe = safeZones.safe;

  if (style === 'imageTop') {
    // Use golden ratio for vertical split
    const [textHeight, imgHeight] = goldenRatio(safe.height);
    const gutter = calculateGutter(safe.height);

    const illustrationRect: Rect = {
      x: safe.x,
      y: safe.y,
      width: safe.width,
      height: snapToGrid(imgHeight),
    };
    const textRect: Rect = {
      x: safe.x,
      y: safe.y + illustrationRect.height + gutter,
      width: safe.width,
      height: safe.height - illustrationRect.height - gutter,
    };
    return { illustrationRect, textRect };
  }

  if (style === 'imageLeft') {
    // Use golden ratio for horizontal split
    const [textWidth, imgWidth] = goldenRatio(safe.width);
    const gutter = calculateGutter(safe.width);

    const illustrationRect: Rect = {
      x: safe.x,
      y: safe.y,
      width: snapToGrid(imgWidth),
      height: safe.height,
    };
    const textRect: Rect = {
      x: safe.x + illustrationRect.width + gutter,
      y: safe.y,
      width: safe.width - illustrationRect.width - gutter,
      height: safe.height,
    };
    return { illustrationRect, textRect };
  }

  if (style === 'imageRight') {
    // Use golden ratio for horizontal split
    const [textWidth, imgWidth] = goldenRatio(safe.width);
    const gutter = calculateGutter(safe.width);

    const illustrationRect: Rect = {
      x: safe.x + safe.width - snapToGrid(imgWidth),
      y: safe.y,
      width: snapToGrid(imgWidth),
      height: safe.height,
    };
    const textRect: Rect = {
      x: safe.x,
      y: safe.y,
      width: safe.width - illustrationRect.width - gutter,
      height: safe.height,
    };
    return { illustrationRect, textRect };
  }

  if (style === 'overlay') {
    // Full-bleed image with text overlay at bottom third
    const illustrationRect: Rect = {
      x: safe.x,
      y: safe.y,
      width: safe.width,
      height: safe.height,
    };

    // Text in bottom third with comfortable padding
    const textPad = snapToGrid(safe.width * 0.06);
    const textHeight = snapToGrid(safe.height * 0.34);

    const textRect: Rect = {
      x: safe.x + textPad,
      y: safe.y + safe.height - textHeight - textPad,
      width: safe.width - textPad * 2,
      height: textHeight,
    };
    return { illustrationRect, textRect };
  }

  // default to 'card': image with text in card below
  // Use golden ratio for vertical division
  const [textHeight, imgHeight] = goldenRatio(safe.height);
  const pad = calculateGutter(Math.min(safe.width, safe.height));

  const illustrationRect: Rect = {
    x: safe.x,
    y: safe.y,
    width: safe.width,
    height: snapToGrid(imgHeight),
  };
  
  const textRect: Rect = {
    x: safe.x + pad,
    y: safe.y + illustrationRect.height + pad,
    width: safe.width - pad * 2,
    height: safe.height - illustrationRect.height - pad * 2,
  };

  return {
    illustrationRect,
    textRect,
    backgroundCard: { 
      radiusPx: snapToGrid(pad * 0.5), 
      paddingPx: pad, 
      shadow: true 
    },
  };
}

export async function decidePrintAndLayouts(
  bookId: string,
  spec: CharacterSpec,
  prefs: BookPrefs,
  pages: PageJSON[],
): Promise<{ print: PrintSpec; perPage: Record<number, PageLayoutPlan> }> {
  // Defaults for robust fallback
  // Default to 16:9 print-friendly page size (landscape)
  const print: PrintSpec = {
    widthIn: 13.33, // 1920px @144dpi ≈ 13.33in; we will render at requested DPI later
    heightIn: 7.5,  // maintains 16:9
    bleedIn: 0.125,
    marginsIn: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
    dpi: 300,
    colorProfile: 'sRGB',
    iccProfilePath: process.env.PRINT_ICC_PROFILE,
    jpegQuality: 94,
    chromaSubsampling: '4:4:4',
  };

  const model = config.models.layout;
  const temperature = config.temperatures.layout;

  try {
    const obj = await runStructuredPrompt({
      bookId,
      step: 'layout',
      version: LAYOUT_PROMPT_VERSION,
      model,
      temperature,
      system: buildLayoutSystem(),
      user: buildLayoutUser(spec, prefs, pages),
    });
    if (obj?.print) {
      const p = obj.print as Partial<PrintSpec>;
      if (typeof p.widthIn === 'number' && typeof p.heightIn === 'number') {
        print.widthIn = p.widthIn;
        print.heightIn = p.heightIn;
      }
      if (typeof p.bleedIn === 'number') print.bleedIn = p.bleedIn;
      if (typeof p.dpi === 'number') print.dpi = p.dpi;
      if (p.marginsIn && typeof p.marginsIn === 'object') {
        print.marginsIn = {
          top: typeof p.marginsIn.top === 'number' ? p.marginsIn.top : print.marginsIn.top,
          right: typeof p.marginsIn.right === 'number' ? p.marginsIn.right : print.marginsIn.right,
          bottom:
            typeof p.marginsIn.bottom === 'number' ? p.marginsIn.bottom : print.marginsIn.bottom,
          left: typeof p.marginsIn.left === 'number' ? p.marginsIn.left : print.marginsIn.left,
        };
      }
    }
    const proposedLayouts: Record<string, LayoutStyle> = obj?.layouts ?? {};
    const proposedStyles: Record<string, any> = obj?.styles ?? {};
    const perPage: Record<number, PageLayoutPlan> = {};
    const widthPx = inchesToPixels(print.widthIn + 2 * print.bleedIn, print.dpi);
    const heightPx = inchesToPixels(print.heightIn + 2 * print.bleedIn, print.dpi);
    const bleedPx = inchesToPixels(print.bleedIn, print.dpi);
    const marginsPx = {
      top: inchesToPixels(print.marginsIn.top, print.dpi),
      right: inchesToPixels(print.marginsIn.right, print.dpi),
      bottom: inchesToPixels(print.marginsIn.bottom, print.dpi),
      left: inchesToPixels(print.marginsIn.left, print.dpi),
    };
    // Determine a locked book body font size from a representative width (use median page text width)
    const sampleWidths: number[] = [];
    for (const page of pages) {
      const chosen: LayoutStyle =
        (proposedLayouts?.[String(page.pageIndex)] as LayoutStyle) ||
        (page.layout as LayoutStyle) ||
        'imageTop';
      const rects = computeRects(chosen, { width: widthPx, height: heightPx, bleedPx }, marginsPx);
      sampleWidths.push(rects.textRect.width);
    }
    sampleWidths.sort((a, b) => a - b);
    const medianWidth = sampleWidths.length === 0 ? widthPx : sampleWidths[Math.floor(sampleWidths.length / 2)];
    // Use fewer characters per line target to encourage larger type for print
    const lockedFontSize = optimalFontSize(medianWidth, 52);

    // Choose font family based on style pack (fallback to system stacks)
    const stylePackId = (obj as any)?.stylePackId || (prefs as any)?.stylePackId || 'storybook_watercolor';
    const stack = getFontStackForStylePack(stylePackId);

    for (const page of pages) {
      const chosen: LayoutStyle =
        (proposedLayouts?.[String(page.pageIndex)] as LayoutStyle) ||
        (page.layout as LayoutStyle) ||
        'imageTop';
      const rects = computeRects(chosen, { width: widthPx, height: heightPx, bleedPx }, marginsPx);
      perPage[page.pageIndex] = {
        style: chosen,
        illustrationRect: rects.illustrationRect,
        textRect: rects.textRect,
        fontFamily: chosen === 'card' ? stack.bodyFamily : stack.bodyFamily,
        // Encourage bigger text with slightly more leading for legibility
        fontSizePx: Math.floor(lockedFontSize * 1.25),
        lineHeight: 1.35,
        textAlign: 'left',
        backgroundCard: rects.backgroundCard,
      };
      // Persist per-page style advice for new books (only if missing)
      try {
        const pageDir = path.join(shared.booksDataDir, bookId, 'pages', String(page.pageIndex));
        const stylePath = path.join(pageDir, 'style.json');
        const exists = await fs
          .access(stylePath)
          .then(() => true)
          .catch(() => false);
        if (!exists) {
          const styleAdvice = proposedStyles?.[String(page.pageIndex)] || {
            palette: spec.palette?.slice(0, 5) || ['#FFCA3A', '#8AC926', '#1982C4', '#6A4C93', '#FF595E'],
            background: { kind: 'textured', baseColor: '#fff9f2', texture: 'watercolor', blend: 'softLight', intensity: 0.18 },
            saturationBoost: 0.18,
            textColor: '#222222',
          };
          await fs.mkdir(pageDir, { recursive: true });
          await fs.writeFile(stylePath, JSON.stringify(styleAdvice, null, 2), 'utf8');
        }
      } catch {}
    }
    return { print, perPage };
  } catch {
    // Deterministic fallback
    const perPage: Record<number, PageLayoutPlan> = {};
    const widthPx = inchesToPixels(print.widthIn + 2 * print.bleedIn, print.dpi);
    const heightPx = inchesToPixels(print.heightIn + 2 * print.bleedIn, print.dpi);
    const bleedPx = inchesToPixels(print.bleedIn, print.dpi);
    const marginsPx = {
      top: inchesToPixels(print.marginsIn.top, print.dpi),
      right: inchesToPixels(print.marginsIn.right, print.dpi),
      bottom: inchesToPixels(print.marginsIn.bottom, print.dpi),
      left: inchesToPixels(print.marginsIn.left, print.dpi),
    };
    for (const page of pages) {
      const index = page.pageIndex;
      const style: LayoutStyle =
        index === 1 ? 'imageTop' : index % 2 === 0 ? 'imageLeft' : 'imageRight';
      const rects = computeRects(style, { width: widthPx, height: heightPx, bleedPx }, marginsPx);
      // Use professional font sizing based on text area width
      const fontBase = optimalFontSize(rects.textRect.width);
      perPage[index] = {
        style,
        illustrationRect: rects.illustrationRect,
        textRect: rects.textRect,
        fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif',
        fontSizePx: fontBase,
        lineHeight: 1.3,
        textAlign: 'left',
        backgroundCard: rects.backgroundCard,
      };
    }
    return { print, perPage };
  }
}

export async function buildLayoutMetaPage(args: {
  text: string;
  stylePackId: string;
  palette?: string[];
  seed: string;
}): Promise<LayoutMeta> {
  return buildLayoutMetadata(args);
}

