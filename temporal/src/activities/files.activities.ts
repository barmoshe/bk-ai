import path from 'path';
import { promises as fs } from 'fs';
import { Manifest, ManifestPageEntry, CharacterSpec, BookPrefs, PrintSpec, PageLayoutPlan, CharacterBibleEntry } from '../types';
import { imageConfig, config } from '../shared';
import { ensureDir } from '../lib/imageIO';

const BOOKS_DIR = config.booksDataDir;

export async function ensureGeneratedDirs() {
  await ensureDir(imageConfig.generatedDir);
  await ensureDir(path.join(imageConfig.generatedDir, 'raw'));
  await ensureDir(path.join(imageConfig.generatedDir, 'clean'));
  await ensureDir(path.join(imageConfig.generatedDir, 'meta'));
  await ensureDir(path.join(imageConfig.generatedDir, 'pages'));
}

export async function writeManifest(
  bookId: string,
  title: string,
  character: CharacterSpec,
  prefs: BookPrefs,
): Promise<string> {
  const root = path.join(BOOKS_DIR, bookId);
  const characterJsonPath = path.join(root, 'character.json');
  const pagesDir = path.join(root, 'pages');
  const entries: ManifestPageEntry[] = [];
  try {
    const pageDirs = await fs.readdir(pagesDir);
    for (const dir of pageDirs) {
      const p = parseInt(dir, 10);
      if (Number.isNaN(p)) continue;
      const pageRoot = path.join(pagesDir, dir);
      const entry: ManifestPageEntry = {
        pageIndex: p,
        textPath: path.join(pageRoot, 'page.json'),
        pngPath: path.join(pageRoot, 'illustration.png'),
        jpegPath: path.join(pageRoot, 'page.jpg'),
      };
      const printJpg = path.join(pageRoot, 'page-print.jpg');
      try {
        await fs.access(printJpg);
        entry.jpegPrintPath = printJpg;
      } catch {}
      // If layout plan saved alongside page, include it
      const layoutPath = path.join(pageRoot, 'layout.json');
      try {
        const raw = await fs.readFile(layoutPath, 'utf8');
        entry.layout = JSON.parse(raw) as PageLayoutPlan;
      } catch {}
      entries.push(entry);
    }
    entries.sort((a, b) => a.pageIndex - b.pageIndex);
  } catch {
    // ignore
  }

  // Try to read print spec if present
  let print: PrintSpec | undefined = undefined;
  const printSpecPath = path.join(root, 'print.json');
  try {
    const raw = await fs.readFile(printSpecPath, 'utf8');
    print = JSON.parse(raw) as PrintSpec;
  } catch {}

  const manifest: Manifest = {
    bookId,
    title,
    character,
    prefs,
    pages: entries,
    print,
    pageAspect: '16:9',
    pageSizePx: { width: 2560, height: 1440 },
    // placeholders for future enrichment
    readingLevel: prefs.targetAge <= 4 ? 'age2_4' : 'age5_7',
    stylePackId: 'storybook_watercolor',
    characterSet: [
      {
        id: 'main',
        name: character.name,
        age: typeof character.age === 'number' ? character.age : prefs.targetAge,
        traits: character.traits,
        physical: [],
        colorTokens: character.palette,
      },
    ],
  };
  // include character bible path if present
  try {
    await fs.access(characterJsonPath);
    (manifest as any).characterBiblePath = characterJsonPath;
  } catch {}
  // Try to include cover if present
  try {
    const coverImage = path.join(root, 'cover', 'cover.jpg');
    await fs.access(coverImage);
    const coverMeta = path.join(root, 'cover', 'cover.json');
    let metaPath: string | undefined = undefined;
    try { await fs.access(coverMeta); metaPath = coverMeta; } catch {}
    manifest.cover = { imagePath: coverImage, metaPath };
  } catch {}
  const outPath = path.join(root, 'manifest.json');
  await fs.writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');
  return outPath;
}

export async function copyChosenCharacter(bookId: string, filename: string): Promise<string> {
  const root = path.join(BOOKS_DIR, bookId, 'characters');
  await fs.mkdir(root, { recursive: true });
  const src = path.join(root, 'options', filename);
  const dest = path.join(root, 'selected.png');
  await fs.copyFile(src, dest);
  return dest;
}

