import { imageConfig } from '../shared';

export type Anchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export interface Frame { x: number; y: number; w: number; h: number; anchor: Anchor; z: number }

export interface LayoutMeta {
  canvas: { width: number; height: number; dpi: number };
  positions: { character: Frame; decor1: Frame; decor2: Frame };
  textArea: {
    x: number; y: number; w: number; h: number;
    direction: 'ltr' | 'rtl'; lineHeight: number; font: string; size: number; weight: number; align: 'left' | 'center' | 'right'
  };
  stylePack: string;
  palette?: string[];
  seed: string;
}

function snap(n: number, grid = 8) { return Math.round(n / grid) * grid; }

export function buildLayoutMetadata(opts: {
  text: string;
  stylePackId: string;
  palette?: string[];
  seed: string;
}): LayoutMeta {
  const { width, height, dpi } = imageConfig.canvas;
  const margins = { top: 32, right: 32, bottom: 32, left: 32 };
  const textRight = opts.text.length % 2 === 0; // simple deterministic choice
  const textW = snap(Math.floor((width - margins.left - margins.right) * 0.44));
  const textH = snap(Math.floor(height - margins.top - margins.bottom));
  const textX = textRight ? width - margins.right - textW : margins.left;
  const textY = margins.top;
  const imgW = snap(Math.floor((width - margins.left - margins.right) - textW - 32));
  const imgH = snap(textH);
  const imgX = textRight ? margins.left : width - margins.right - imgW;
  const imgY = margins.top;

  const character: Frame = { x: imgX + snap(imgW * 0.12), y: imgY + snap(imgH * 0.1), w: snap(imgW * 0.6), h: snap(imgH * 0.8), anchor: 'center', z: 2 };
  const decor1: Frame = { x: imgX + snap(imgW * 0.04), y: imgY + snap(imgH * 0.04), w: snap(imgW * 0.28), h: snap(imgH * 0.28), anchor: 'top-left', z: 1 };
  const decor2: Frame = { x: imgX + snap(imgW * 0.72), y: imgY + snap(imgH * 0.64), w: snap(imgW * 0.24), h: snap(imgH * 0.24), anchor: 'bottom-right', z: 1 };

  return {
    canvas: { width, height, dpi },
    positions: { character, decor1, decor2 },
    textArea: {
      x: textX, y: textY, w: textW, h: textH,
      direction: 'ltr', lineHeight: 1.3, font: 'Atkinson Hyperlegible, Inter, Helvetica Neue, Arial, sans-serif', size: 42, weight: 400, align: 'left'
    },
    stylePack: opts.stylePackId,
    palette: opts.palette,
    seed: opts.seed,
  };
}


