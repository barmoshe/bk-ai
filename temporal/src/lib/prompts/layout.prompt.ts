import { BookPrefs, CharacterSpec, PageJSON } from '../../types';

export const LAYOUT_PROMPT_VERSION = 'layout-v2';

export function buildSystem(): string {
  return `You decide print specs and layout styles for a children's book.
Output JSON with keys: print, layouts, styles.
- print: { widthIn, heightIn, bleedIn, marginsIn{top,right,bottom,left}, dpi }
- layouts: map pageIndex -> style in [imageRight,imageLeft,imageTop,card,overlay]
- styles: map pageIndex -> { palette: hex[], background: { kind: 'solid'|'gradient'|'paper'|'textured', ... }, saturationBoost?: number, textColor?: string }
No prose.`;
}

export function buildUser(spec: CharacterSpec, prefs: BookPrefs, pages: PageJSON[]): string {
  const summaries = pages
    .slice(0, 24)
    .map(p => ({ i: p.pageIndex, t: (p.text || '').slice(0, 160) }))
    .map(o => `#${o.i}: ${o.t}`)
    .join(' | ');
  return `Title: ${prefs.title}. Topic: ${prefs.topic}. Tone: ${prefs.tone}. Style: ${spec.style}. Palette: ${spec.palette.join(', ')}. Pages: ${pages.length}.
Pages summary: ${summaries}`;
}


