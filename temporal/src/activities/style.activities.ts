import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import { StyleProfile, CharacterBibleEntry } from '../types';
import crypto from 'crypto';
import { config } from '../shared';

let client: OpenAI | undefined;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: config.getApiKey() });
  }
  return client;
}

const BOOKS_DIR = config.booksDataDir;

function toDataUrl(buf: Buffer, mime: string) {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export async function analyzeStyleProfile(bookId: string): Promise<StyleProfile> {
  const selectedPath = path.join(BOOKS_DIR, bookId, 'characters', 'selected.png');
  const buf = await fs.readFile(selectedPath);
  const imageDataUrl = toDataUrl(buf, 'image/png');

  const system =
    'Output JSON with keys dominantPalette (hex[]), attire (string[]), traits (string[]), artDirection { camera, lighting, composition, texture }.';
  const userText = "Analyze this character image for consistent reproduction in a children's book.";

  const resp = await getClient().chat.completions.create({
    model: config.models.vision,
    response_format: { type: 'json_object' } as any,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText } as any,
          { type: 'image_url', image_url: { url: imageDataUrl } } as any,
        ],
      } as any,
    ],
  });

  let profile: StyleProfile = {
    dominantPalette: [],
    attire: [],
    traits: [],
    artDirection: { camera: '', lighting: '', composition: '', texture: '' },
  };
  try {
    const content = resp.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);
    profile = {
      dominantPalette: Array.isArray(parsed?.dominantPalette) ? parsed.dominantPalette : [],
      attire: Array.isArray(parsed?.attire) ? parsed.attire : [],
      traits: Array.isArray(parsed?.traits) ? parsed.traits : [],
      artDirection: {
        camera: String(parsed?.artDirection?.camera ?? ''),
        lighting: String(parsed?.artDirection?.lighting ?? ''),
        composition: String(parsed?.artDirection?.composition ?? ''),
        texture: String(parsed?.artDirection?.texture ?? ''),
      },
    };
  } catch {}

  const outPath = path.join(BOOKS_DIR, bookId, 'style.json');
  // compute a stable style tag for reproducibility
  const tag = crypto
    .createHash('sha256')
    .update(JSON.stringify({ palette: profile.dominantPalette, attire: profile.attire, traits: profile.traits, art: profile.artDirection }))
    .digest('hex')
    .slice(0, 12);
  const enriched = { ...profile, styleTag: tag } as any;
  await fs.writeFile(outPath, JSON.stringify(enriched, null, 2), 'utf8');

  // If a character bible exists, ensure its palette includes the analyzed dominant palette
  try {
    const root = path.join(BOOKS_DIR, bookId);
    const biblePath = path.join(root, 'character.json');
    const raw = await fs.readFile(biblePath, 'utf8');
    const bible = JSON.parse(raw) as CharacterBibleEntry;
    const mergedPalette = Array.from(new Set([...(bible.palette || []), ...profile.dominantPalette]));
    const updated = { ...bible, palette: mergedPalette } as CharacterBibleEntry;
    await fs.writeFile(biblePath, JSON.stringify(updated, null, 2), 'utf8');
  } catch {}
  return profile;
}











