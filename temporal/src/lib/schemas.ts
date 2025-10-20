import { BookPrefs, PageJSON } from '../types';

// JSON Schema objects for optional model-side enforcement
export const PageSchemaJson: any = {
  type: 'object',
  additionalProperties: false,
  required: ['pageIndex', 'text', 'imagePrompt', 'layout', 'imageUrl'],
  properties: {
    pageIndex: { type: 'integer', minimum: 1 },
    text: { type: 'string', maxLength: 800 },
    imagePrompt: { type: 'string', maxLength: 200 },
    layout: { type: 'string', enum: ['imageRight', 'imageLeft', 'imageTop'] },
    imageUrl: { type: 'string' },
    // Optional border effect guidance from the AI (non-breaking)
    borderEffect: {
      type: 'string',
      enum: [
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
      ],
    },
    borderConfig: {
      type: 'object',
      additionalProperties: false,
      properties: {
        width: { type: 'number' },
        color: { type: 'string' },
        shadowOpacity: { type: 'number' },
        shadowBlur: { type: 'number' },
        cornerRadius: { type: 'number' },
        intensity: { type: 'number' },
      },
    },
  },
};

export const PagesResponseSchemaJson: any = {
  type: 'object',
  additionalProperties: false,
  required: ['pages'],
  properties: {
    pages: { type: 'array', items: PageSchemaJson },
  },
};

const allowedLayouts = new Set(['imageRight', 'imageLeft', 'imageTop']);
const allowedBorders = new Set([
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
]);

function coercePage(raw: any, index: number): PageJSON | null {
  if (!raw || typeof raw !== 'object') return null;
  const pageIndexNum = Number((raw as any).pageIndex ?? index);
  if (!Number.isFinite(pageIndexNum) || pageIndexNum < 1) return null;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  const imagePrompt = typeof raw.imagePrompt === 'string' ? raw.imagePrompt.trim() : '';
  const layoutRaw = typeof raw.layout === 'string' ? raw.layout : 'imageTop';
  const layout = allowedLayouts.has(String(layoutRaw)) ? (layoutRaw as PageJSON['layout']) : 'imageTop';
  const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl : '';
  const out: PageJSON = { pageIndex: pageIndexNum, text, imagePrompt, layout, imageUrl };
  // Optional border fields (carry through if present and valid)
  const be = typeof (raw as any).borderEffect === 'string' ? String((raw as any).borderEffect) : undefined;
  if (be && allowedBorders.has(be)) {
    (out as any).borderEffect = be as any;
  }
  const bc = (raw as any).borderConfig;
  if (bc && typeof bc === 'object') {
    const cfg: any = {};
    if (typeof bc.width === 'number') cfg.width = bc.width;
    if (typeof bc.color === 'string') cfg.color = bc.color;
    if (typeof bc.shadowOpacity === 'number') cfg.shadowOpacity = bc.shadowOpacity;
    if (typeof bc.shadowBlur === 'number') cfg.shadowBlur = bc.shadowBlur;
    if (typeof bc.cornerRadius === 'number') cfg.cornerRadius = bc.cornerRadius;
    if (typeof bc.intensity === 'number') cfg.intensity = bc.intensity;
    (out as any).borderConfig = cfg;
  }
  // Clamp text to <=100 words if present (align with existing behavior)
  if (out.text) {
    const words = out.text.split(/\s+/).filter(Boolean);
    if (words.length > 100) out.text = words.slice(0, 100).join(' ');
  }
  return out;
}

export function validatePagesResponse(obj: any, prefs: BookPrefs): PageJSON[] {
  const pages: PageJSON[] = [];
  const src = Array.isArray(obj?.pages) ? obj.pages : [];
  // Create an index -> page map using pageIndex if possible
  const map = new Map<number, PageJSON>();
  for (const raw of src) {
    const p = coercePage(raw, 0);
    if (p) map.set(p.pageIndex, p);
  }
  for (let i = 1; i <= prefs.pages; i++) {
    const found = map.get(i);
    if (found) {
      pages.push({ ...found, pageIndex: i });
      continue;
    }
    // fallback minimal page matching existing behavior
    const scaffold = i === 1
      ? 'hero introduction at home, morning, warm mood'
      : i < prefs.pages
      ? 'small activity outdoors, afternoon, curious mood'
      : 'cozy resolution at home, evening, calm mood';
    const seed = `${prefs.title || prefs.topic}: ${scaffold}`.trim();
    pages.push({
      pageIndex: i,
      text: '',
      imagePrompt: seed,
      layout: 'imageTop',
      imageUrl: '',
    });
  }
  return pages;
}


