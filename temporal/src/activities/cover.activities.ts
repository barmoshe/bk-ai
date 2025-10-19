import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Context } from '@temporalio/activity';
import { ApplicationFailure } from '@temporalio/common';
import { config } from '../shared';

const BOOKS_DIR = config.booksDataDir;

type AgeBand = '3-5' | '6-8' | '9-12' | number;

export interface GenerateCoverOptionsInput {
  bookId: string;
  title: string;
  tone?: string;
  themes?: string[];
  ageBand?: AgeBand;
  count?: number; // default 4
  size?: '1024x1024' | '768x768' | '512x512';
}

export interface CoverOptionMeta {
  optionId: string; // e.g., option-01
  fileName: string; // e.g., option-01.jpg
  path: string;     // absolute path
  palette?: string[];
  readabilityScore?: number; // heuristic score
}

export interface GenerateCoverOptionsResult {
  options: CoverOptionMeta[];
}

function buildCoverPrompt({ title, tone, themes, ageBand }: { title: string; tone?: string; themes?: string[]; ageBand?: AgeBand }): string {
  const ageText = typeof ageBand === 'number' ? `${ageBand}` : (ageBand || '6-8');
  const themeText = (themes && themes.length) ? themes.join(', ') : 'adventure, friendship';
  const toneText = tone || 'cheerful';
  return [
    `Front cover for a children's book titled "${title}".`,
    `Large, legible title text on the cover, high contrast, child-friendly palette for age ${ageText}.`,
    `Keep all important text within 12% margins (safe area).`,
    `Visual direction: ${toneText}. Themes: ${themeText}.`,
    `Single clear focal illustration. Avoid overcrowding, no extra small text.`,
  ].join(' ');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function generateCoverOptionsWithText(input: GenerateCoverOptionsInput): Promise<GenerateCoverOptionsResult> {
  const apiKey = config.getApiKey();
  if (!apiKey) throw ApplicationFailure.nonRetryable('OPENAI_API_KEY not set');

  const count = Math.max(2, Math.min(4, input.count ?? 4));
  const size = input.size || '1024x1024';
  const bookDir = path.join(BOOKS_DIR, input.bookId, 'cover');
  const optionsDir = path.join(bookDir, 'options');
  await ensureDir(optionsDir);

  const prompt = buildCoverPrompt({ title: input.title, tone: input.tone, themes: input.themes, ageBand: input.ageBand });
  const options: CoverOptionMeta[] = [];

  for (let i = 1; i <= count; i++) {
    const optionId = `option-${String(i).padStart(2, '0')}`;
    const fileName = `${optionId}.jpg`;
    const outPath = path.join(optionsDir, fileName);

    try {
      try { Context.current().heartbeat({ step: 'cover', status: 'generating', current: i, total: count }); } catch {}

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.models.image, prompt, size, n: 1 }),
      });
      if (!response.ok) {
        const errText = await response.text();
        const error = new Error(`Cover image API ${response.status}: ${errText}`);
        if (response.status === 429 || response.status >= 500) throw error; // retry by workflow/activity policy
        throw ApplicationFailure.nonRetryable(error.message);
      }
      const json: any = await response.json();
      const first = json.data?.[0];
      const imageUrl = first?.url;
      const b64 = first?.b64_json;
      let buf: Buffer;
      if (imageUrl) {
        const img = await fetch(imageUrl);
        if (!img.ok) throw new Error(`Failed to download cover image URL (${img.status})`);
        buf = Buffer.from(await img.arrayBuffer());
      } else if (b64) {
        buf = Buffer.from(b64, 'base64');
      } else {
        throw ApplicationFailure.nonRetryable('Cover generation returned no url/b64_json');
      }

      // Convert to JPEG with progressive encoding for fast preview
      const jpeg = await sharp(buf)
        .jpeg({ quality: 88, progressive: true, mozjpeg: true })
        .toBuffer();
      await fs.writeFile(outPath, jpeg);

      // Palette/readability heuristics
      let palette: string[] | undefined = undefined;
      let readabilityScore: number | undefined = undefined;
      try {
        const stats = await sharp(jpeg).stats();
        const channels = stats.channels || [];
        const mean = channels.slice(0, 3).reduce((s, c) => s + (c.mean || 0), 0) / 3;
        const stdDev = channels.slice(0, 3).reduce((s, c) => s + (c.stdev || 0), 0) / 3;
        readabilityScore = Math.max(0, Math.min(1, (stdDev / 64) * 0.7 + (mean > 120 ? 0.3 : 0)));
        palette = channels.slice(0, 3).map(c => `#${Math.max(0, Math.min(255, Math.round(c.mean))).toString(16).padStart(2, '0').repeat(3)}`);
      } catch {}

      options.push({ optionId, fileName, path: outPath, palette, readabilityScore });
    } catch (e: any) {
      try { Context.current().heartbeat({ step: 'cover', status: 'failed', current: i, message: String(e?.message || e) }); } catch {}
      throw e;
    }
  }

  try { Context.current().heartbeat({ step: 'cover', status: 'done', count: options.length }); } catch {}
  return { options };
}

export async function rankCoversByReadabilityAndBranding(options: CoverOptionMeta[]): Promise<CoverOptionMeta[]> {
  // Simple descending sort by readabilityScore; stable as-is
  return [...options].sort((a, b) => (b.readabilityScore || 0) - (a.readabilityScore || 0));
}

export async function persistSelectedCover(args: { bookId: string; selected: CoverOptionMeta; title: string; safeAreaPct?: number }): Promise<string> {
  const bookDir = path.join(BOOKS_DIR, args.bookId, 'cover');
  const outPath = path.join(bookDir, 'cover.jpg');
  await ensureDir(bookDir);
  const bytes = await fs.readFile(args.selected.path);
  await fs.writeFile(outPath, bytes);
  const safe = Math.max(0, Math.min(0.2, (args.safeAreaPct ?? 0.12)));
  const meta = {
    title: args.title,
    selected: { optionId: args.selected.optionId, fileName: args.selected.fileName },
    palette: args.selected.palette || [],
    safeAreas: { top: safe, right: safe, bottom: safe, left: safe, gutter: safe },
  };
  await fs.writeFile(path.join(bookDir, 'cover.json'), JSON.stringify(meta, null, 2), 'utf8');
  return outPath;
}


