import OpenAI from 'openai';
import path from 'path';
import { promises as fs } from 'fs';
import { config } from '../shared';
import type { PageJSON, BookPrefs, PageStyleAdvice, BookStyleAdvice } from '../types';

let client: OpenAI | undefined;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: config.getApiKey() });
  return client;
}

const BOOKS_DIR = config.booksDataDir;

export async function adviseBookStyle(bookId: string, prefs: BookPrefs): Promise<BookStyleAdvice> {
  // Try existing
  const stylePath = path.join(BOOKS_DIR, bookId, 'style.json');
  try {
    const raw = await fs.readFile(stylePath, 'utf8');
    return JSON.parse(raw);
  } catch {}

  // Basic fallback without calling AI
  const fallback: BookStyleAdvice = {
    defaultPalette: ['#FFB703', '#FB8500', '#219EBC', '#8ECAE6', '#023047'],
    defaultLayout: 'imageTop',
    background: { kind: 'solid', color: '#ffffff' },
  };
  if (!config.getApiKey()) return fallback;

  const system = 'Return compact JSON matching keys: defaultPalette (hex[]), defaultLayout, background.';
  const user = `prefs=${JSON.stringify(prefs)} palettesKnown=['storybook_watercolor','flat_vector','soft_clay']`;
  try {
    const resp = await getClient().chat.completions.create({
      model: config.models.layout,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' } as any,
    });
    const content = resp.choices?.[0]?.message?.content || '';
    const advice = JSON.parse(content) as BookStyleAdvice;
    await fs.writeFile(stylePath, JSON.stringify(advice, null, 2), 'utf8');
    return advice;
  } catch {
    return fallback;
  }
}

export async function advisePageStyle(bookId: string, page: PageJSON, prefs: BookPrefs): Promise<PageStyleAdvice> {
  const pageDir = path.join(BOOKS_DIR, bookId, 'pages', String(page.pageIndex));
  const stylePath = path.join(pageDir, 'style.json');
  try {
    const raw = await fs.readFile(stylePath, 'utf8');
    return JSON.parse(raw);
  } catch {}

  // Ensure directory exists
  try { await fs.mkdir(pageDir, { recursive: true }); } catch {}

  // Fallback if AI not available
  const fallback: PageStyleAdvice = {
    palette: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93'],
    layoutStyle: page.layout === 'imageTop' ? 'imageTop' : page.layout === 'imageLeft' ? 'imageLeft' : page.layout === 'imageRight' ? 'imageRight' : 'card',
    background: { kind: 'solid', color: '#ffffff' },
    saturationBoost: 0.15,
  };
  if (!config.getApiKey()) {
    await fs.writeFile(stylePath, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }

  const system = 'Return compact JSON for PageStyleAdvice: palette (hex[]), layoutStyle, background (solid|gradient|paper|textured), optional decoration, saturationBoost (0..0.4). No prose.';
  const user = `prefs=${JSON.stringify(prefs)} pageText=${JSON.stringify(page.text).slice(0, 1200)} textures=[paper,canvas,watercolor,grain,halftone,crayon,linen]`;
  try {
    const resp = await getClient().chat.completions.create({
      model: config.models.layout,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' } as any,
    });
    const content = resp.choices?.[0]?.message?.content || '';
    const advice = JSON.parse(content) as PageStyleAdvice;
    await fs.writeFile(stylePath, JSON.stringify(advice, null, 2), 'utf8');
    return advice;
  } catch {
    await fs.writeFile(stylePath, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}


