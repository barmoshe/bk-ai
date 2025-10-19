/**
 * Modular rendering pipeline with clean separation of concerns
 * Architecture: Layout → Typography → Compositor → Encoder
 */

import sharp from 'sharp';
import { PrintProfile } from '../config/print-profiles';
import type { BackgroundSpec } from '../types';
import { generateTextSVG, TypographyConfig, TextBox } from './typography';
import { getFontStackForStylePack } from './styleFonts';
import { buildEmbeddedCssFromStack } from './fontEmbed';
import { applySharpen, SharpeningConfig, resizeForPrint } from './image-processing';
import { applyColorProfile } from './color-management';
import { calculateSafeZones, SafeZones } from './layout-grid';

export interface RenderContext {
  /** Canvas dimensions in pixels (including bleed) */
  width: number;
  height: number;
  /** Bleed area in pixels */
  bleedPx: number;
  /** Safe zones for content placement */
  safeZones: SafeZones;
  /** Print profile for output */
  profile: PrintProfile;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageLayout {
  /** Position for illustration */
  illustration: LayoutRect;
  /** Position for text */
  text: LayoutRect;
  /** Optional background card behind text */
  backgroundCard?: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    color: string;
    shadow?: boolean;
  };
}

export interface RenderLayer {
  buffer: Buffer;
  x: number;
  y: number;
  blend?: sharp.Blend;
}

/**
 * Stage 1: Layout Engine
 * Calculates precise positions and dimensions for all elements
 */
export class LayoutEngine {
  constructor(private context: RenderContext) {}

  /**
   * Calculate layout for a page based on style
   */
  computeLayout(
    style: 'imageTop' | 'imageLeft' | 'imageRight' | 'overlay' | 'card' | 'fullBleed' | 'panelGrid'
  ): PageLayout {
    const safe = this.context.safeZones.safe;

    switch (style) {
      case 'fullBleed':
        return this.layoutFullBleed(safe);
      case 'panelGrid':
        return this.layoutPanelGrid(safe);
      case 'imageTop':
        return this.layoutImageTop(safe);
      case 'imageLeft':
        return this.layoutImageLeft(safe);
      case 'imageRight':
        return this.layoutImageRight(safe);
      case 'overlay':
        return this.layoutOverlay(safe);
      case 'card':
      default:
        return this.layoutCard(safe);
    }
  }

  private layoutImageTop(safe: LayoutRect): PageLayout {
    const gutter = Math.floor(safe.height * 0.04);
    const imgHeight = Math.floor(safe.height * 0.55);

    return {
      illustration: {
        x: safe.x,
        y: safe.y,
        width: safe.width,
        height: imgHeight,
      },
      text: {
        x: safe.x,
        y: safe.y + imgHeight + gutter,
        width: safe.width,
        height: safe.height - imgHeight - gutter,
      },
    };
  }

  private layoutImageLeft(safe: LayoutRect): PageLayout {
    const gutter = Math.floor(safe.width * 0.04);
    const imgWidth = Math.floor(safe.width * 0.45);

    return {
      illustration: {
        x: safe.x,
        y: safe.y,
        width: imgWidth,
        height: safe.height,
      },
      text: {
        x: safe.x + imgWidth + gutter,
        y: safe.y,
        width: safe.width - imgWidth - gutter,
        height: safe.height,
      },
    };
  }

  private layoutImageRight(safe: LayoutRect): PageLayout {
    const gutter = Math.floor(safe.width * 0.04);
    const imgWidth = Math.floor(safe.width * 0.45);

    return {
      illustration: {
        x: safe.x + safe.width - imgWidth,
        y: safe.y,
        width: imgWidth,
        height: safe.height,
      },
      text: {
        x: safe.x,
        y: safe.y,
        width: safe.width - imgWidth - gutter,
        height: safe.height,
      },
    };
  }

  private layoutOverlay(safe: LayoutRect): PageLayout {
    return {
      illustration: {
        x: safe.x,
        y: safe.y,
        width: safe.width,
        height: safe.height,
      },
      text: {
        x: safe.x + Math.floor(safe.width * 0.06),
        y: safe.y + Math.floor(safe.height * 0.58),
        width: Math.floor(safe.width * 0.88),
        height: Math.floor(safe.height * 0.34),
      },
    };
  }

  private layoutFullBleed(safe: LayoutRect): PageLayout {
    // Illustration occupies the full safe area; text as overlay band at bottom
    const bandH = Math.floor(safe.height * 0.28);
    return {
      illustration: { x: safe.x, y: safe.y, width: safe.width, height: safe.height },
      text: { x: safe.x + Math.floor(safe.width * 0.06), y: safe.y + safe.height - bandH - Math.floor(safe.height * 0.02), width: Math.floor(safe.width * 0.88), height: bandH },
      backgroundCard: undefined,
    };
  }

  private layoutPanelGrid(safe: LayoutRect): PageLayout {
    // Simple 2-panel grid: illustration left 2/3, text right 1/3
    const gutter = Math.floor(safe.width * 0.04);
    const leftW = Math.floor(safe.width * 0.62);
    return {
      illustration: { x: safe.x, y: safe.y, width: leftW, height: safe.height },
      text: { x: safe.x + leftW + gutter, y: safe.y, width: safe.width - leftW - gutter, height: safe.height },
    };
  }

  private layoutCard(safe: LayoutRect): PageLayout {
    const imgHeight = Math.floor(safe.height * 0.62);
    const pad = Math.floor(Math.min(safe.width, safe.height) * 0.02);
    const radius = Math.floor(pad * 0.8);

    return {
      illustration: {
        x: safe.x,
        y: safe.y,
        width: safe.width,
        height: imgHeight,
      },
      text: {
        x: safe.x + pad,
        y: safe.y + imgHeight + pad,
        width: safe.width - pad * 2,
        height: safe.height - imgHeight - pad * 2,
      },
      backgroundCard: {
        x: safe.x,
        y: safe.y + imgHeight,
        width: safe.width,
        height: safe.height - imgHeight,
        radius,
        color: '#ffffff',
        shadow: true,
      },
    };
  }
}

/**
 * Stage 2: Typography Renderer
 * Creates text layers with professional typography
 */
export class TypographyRenderer {
  /**
   * Render text as SVG layer
   */
  async renderTextLayer(
    text: string,
    box: TextBox,
    config: TypographyConfig,
    canvasWidth: number,
    canvasHeight: number,
    forcedLines?: string[]
  ): Promise<Buffer> {
    const textSvgCore = generateTextSVG(text, box, config, forcedLines);
    // Attempt to embed fonts if config.fontFamily is one of our mapped stacks (best-effort)
    let embeddedCss = '';
    try {
      // We cannot infer stylePackId here reliably; instead, try to match the preferred family from config
      const { findStackByPreferredFamily } = await import('./styleFonts.js');
      const stack = findStackByPreferredFamily(config.fontFamily) || getFontStackForStylePack(undefined);
      embeddedCss = await buildEmbeddedCssFromStack(stack);
    } catch {}
    const svg = embeddedCss
      ? `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg"><style>${embeddedCss}</style>${textSvgCore}</svg>`
      : `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">${textSvgCore}</svg>`;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  /**
   * Render background card for text
   */
  async renderCardLayer(
    card: NonNullable<PageLayout['backgroundCard']>,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<Buffer> {
    const shadow = card.shadow
      ? `<defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000055"/>
        </filter>
      </defs>`
      : '';

    const filter = card.shadow ? 'filter="url(#shadow)"' : '';

    const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  ${shadow}
  <rect 
    x="${card.x}" 
    y="${card.y}" 
    rx="${card.radius}" 
    ry="${card.radius}" 
    width="${card.width}" 
    height="${card.height}" 
    fill="${card.color}" 
    ${filter} />
</svg>`;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}

/**
 * Stage 3: Image Compositor
 * Combines all layers into final composition
 */
export class ImageCompositor {
  constructor(private context: RenderContext) {}

  /**
   * Create base canvas
   */
  async createCanvas(backgroundColor: string = '#ffffff'): Promise<Buffer> {
    return sharp({
      create: {
        width: this.context.width,
        height: this.context.height,
        channels: 3,
        background: backgroundColor,
      },
    })
      .png()
      .toBuffer();
  }

  async renderBackground(spec?: BackgroundSpec): Promise<Buffer | null> {
    if (!spec) return null;
    const w = this.context.width;
    const h = this.context.height;
    if (spec.kind === 'solid') {
      return sharp({ create: { width: w, height: h, channels: 3, background: spec.color } }).png().toBuffer();
    }
    if (spec.kind === 'gradient') {
      const angle = spec.angle ?? 90;
      const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" gradientTransform="rotate(${angle})">
            <stop offset="0%" stop-color="${spec.from}"/>
            <stop offset="100%" stop-color="${spec.to}"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${w}" height="${h}" fill="url(#g)"/>
      </svg>`;
      return sharp(Buffer.from(svg)).png().toBuffer();
    }
    if (spec.kind === 'paper') {
      const base = sharp({ create: { width: w, height: h, channels: 3, background: spec.color || '#faf7f2' } }).png();
      const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <filter id="n" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="${spec.texture === 'heavy' ? 0.9 : spec.texture === 'medium' ? 0.6 : 0.35}" numOctaves="1" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="linear" slope="0.08"/></feComponentTransfer>
        </filter>
        <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" filter="url(#n)"/>
      </svg>`;
      const grain = sharp(Buffer.from(svg)).png();
      const [b, g] = await Promise.all([base.toBuffer(), grain.toBuffer()]);
      return sharp(b).composite([{ input: g, left: 0, top: 0, blend: 'multiply' }]).png().toBuffer();
    }
    if (spec.kind === 'textured') {
      const base = sharp({ create: { width: w, height: h, channels: 3, background: spec.baseColor } }).png();
      const freq = spec.texture === 'canvas' ? 0.8 : spec.texture === 'watercolor' ? 0.3 : spec.texture === 'grain' ? 0.9 : spec.texture === 'halftone' ? 0.2 : spec.texture === 'crayon' ? 0.5 : 0.4;
      const slope = Math.max(0, Math.min(1, spec.intensity ?? 0.18));
      const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <filter id="tex" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="${spec.texture === 'halftone' ? 'turbulence' : 'fractalNoise'}" baseFrequency="${freq}" numOctaves="1" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="linear" slope="${slope}"/></feComponentTransfer>
        </filter>
        <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" filter="url(#tex)"/>
      </svg>`;
      const tex = sharp(Buffer.from(svg)).png();
      const [b, t] = await Promise.all([base.toBuffer(), tex.toBuffer()]);
      // Normalize potential camelCase blend from persisted advice
      const rawBlend = (spec.blend as any) || 'overlay';
      const normalizedBlend = rawBlend === 'softLight' ? 'soft-light' : rawBlend;
      const blend: sharp.Blend = normalizedBlend as sharp.Blend;
      return sharp(b).composite([{ input: t, left: 0, top: 0, blend }]).png().toBuffer();
    }
    return null;
  }

  /**
   * Prepare illustration to fit within layout rect
   */
  async prepareIllustration(
    illustrationBuffer: Buffer,
    targetRect: LayoutRect
  ): Promise<Buffer> {
    return resizeForPrint(illustrationBuffer, targetRect.width, targetRect.height, {
      fit: 'inside',
      kernel: 'lanczos3',
    });
  }

  /**
   * Composite all layers
   */
  async composite(baseCanvas: Buffer, layers: RenderLayer[]): Promise<Buffer> {
    const composites: sharp.OverlayOptions[] = layers.map(layer => ({
      input: layer.buffer,
      left: layer.x,
      top: layer.y,
      blend: layer.blend,
    }));

    return sharp(baseCanvas).composite(composites).png().toBuffer();
  }
}

/**
 * Stage 4: Output Encoder
 * Applies color management, sharpening, and final encoding
 */
export class OutputEncoder {
  constructor(private context: RenderContext) {}

  /**
   * Encode to JPEG with full quality control
   */
  async encodeJPEG(compositeBuffer: Buffer, opts?: { saturationBoost?: number }): Promise<Buffer> {
    const profile = this.context.profile;

    let pipeline = sharp(compositeBuffer);

    if (opts?.saturationBoost && this.context.profile.id === 'screen') {
      const sat = Math.max(0, Math.min(0.6, opts.saturationBoost));
      pipeline = pipeline.modulate({ saturation: 1 + sat });
    }

    // Apply sharpening
    const sharpenConfig: SharpeningConfig = {
      radius: profile.sharpenRadius,
      amount: profile.sharpening,
    };
    pipeline = applySharpen(pipeline, sharpenConfig);

    // Apply color profile
    pipeline = await applyColorProfile(
      pipeline,
      profile.colorSpace,
      profile.iccProfilePath
    );

    // Set DPI metadata
    pipeline = pipeline.withMetadata({ density: profile.dpi });

    // Encode to JPEG
    return pipeline
      .jpeg({
        quality: profile.quality,
        chromaSubsampling: profile.chromaSubsampling,
        mozjpeg: profile.useMozjpeg,
        progressive: profile.progressive || false,
      })
      .toBuffer();
  }
}

/**
 * Complete rendering pipeline orchestrator
 */
export class RenderPipeline {
  private layoutEngine: LayoutEngine;
  private typographyRenderer: TypographyRenderer;
  private compositor: ImageCompositor;
  private encoder: OutputEncoder;

  constructor(private context: RenderContext) {
    this.layoutEngine = new LayoutEngine(context);
    this.typographyRenderer = new TypographyRenderer();
    this.compositor = new ImageCompositor(context);
    this.encoder = new OutputEncoder(context);
  }

  /**
   * Render a complete page
   */
  async renderPage(input: {
    text: string;
    illustrationBuffer: Buffer;
    layoutStyle: 'imageTop' | 'imageLeft' | 'imageRight' | 'overlay' | 'card' | 'fullBleed' | 'panelGrid';
    typographyConfig: TypographyConfig;
    backgroundColor?: string;
    backgroundSpec?: BackgroundSpec;
    decorationLayers?: Array<{ buffer: Buffer; x: number; y: number; blend?: sharp.Blend }>;
    saturationBoost?: number;
    forcedLines?: string[];
  }): Promise<Buffer> {
    // Stage 1: Calculate layout
    const layout = this.layoutEngine.computeLayout(input.layoutStyle);

    // Stage 2: Create base canvas
    const canvas = await this.compositor.createCanvas(input.backgroundColor);
    const bg = await this.compositor.renderBackground(input.backgroundSpec);

    // Stage 3: Prepare illustration
    const illustration = await this.compositor.prepareIllustration(
      input.illustrationBuffer,
      layout.illustration
    );

    // Stage 4: Build layers
    const layers: RenderLayer[] = [];
    if (bg) layers.push({ buffer: bg, x: 0, y: 0 });

    // Add background card if present
    if (layout.backgroundCard) {
      const card = await this.typographyRenderer.renderCardLayer(
        layout.backgroundCard,
        this.context.width,
        this.context.height
      );
      layers.push({ buffer: card, x: 0, y: 0 });
    }

    // Add illustration
    layers.push({
      buffer: illustration,
      x: layout.illustration.x,
      y: layout.illustration.y,
    });

    // Add text
    const textLayer = await this.typographyRenderer.renderTextLayer(
      input.text,
      layout.text,
      input.typographyConfig,
      this.context.width,
      this.context.height,
      input.forcedLines
    );
    layers.push({ buffer: textLayer, x: 0, y: 0 });
    if (input.decorationLayers && input.decorationLayers.length) {
      for (const d of input.decorationLayers) {
        layers.push({ buffer: d.buffer, x: d.x, y: d.y, blend: d.blend });
      }
    }

    // Stage 5: Composite
    const composite = await this.compositor.composite(canvas, layers);

    // Stage 6: Encode
    return this.encoder.encodeJPEG(composite, { saturationBoost: input.saturationBoost });
  }

  /**
   * Get the layout for inspection (useful for debugging/preview)
   */
  getLayout(style: 'imageTop' | 'imageLeft' | 'imageRight' | 'overlay' | 'card'): PageLayout {
    return this.layoutEngine.computeLayout(style);
  }
}

/**
 * Factory function to create render pipeline with context
 */
export function createRenderPipeline(
  widthPx: number,
  heightPx: number,
  bleedPx: number,
  marginsPx: { top: number; right: number; bottom: number; left: number },
  profile: PrintProfile
): RenderPipeline {
  const safeZones = calculateSafeZones(widthPx, heightPx, bleedPx, marginsPx);

  const context: RenderContext = {
    width: widthPx,
    height: heightPx,
    bleedPx,
    safeZones,
    profile,
  };

  return new RenderPipeline(context);
}

