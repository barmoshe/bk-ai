import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { generateThemeFromSeed } from '@/lib/theme';

const ROOT = process.env.BOOKS_DATA_DIR ?? './data/book';

export async function POST(req: NextRequest) {
  const updated: Array<{ id: string; wroteTheme: boolean; updatedManifest: boolean }> = [];
  try {
    const dirs = await fs.readdir(ROOT, { withFileTypes: true });
    for (const dirent of dirs) {
      if (!dirent.isDirectory()) continue;
      const id = dirent.name;
      const bookRoot = path.join(ROOT, id);
      const manifestPath = path.join(bookRoot, 'manifest.json');
      const themeJsonPath = path.join(bookRoot, 'theme.json');
      let manifest: any = null;
      let wroteTheme = false;
      let updatedManifest = false;
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        manifest = JSON.parse(raw);
      } catch {
        continue;
      }

      // If manifest already has theme and theme.json exists, skip
      let themeObj: any = manifest?.theme || null;
      if (!themeObj) {
        // Try theme.json
        try {
          const rawTheme = await fs.readFile(themeJsonPath, 'utf8');
          themeObj = JSON.parse(rawTheme);
        } catch {
          // Generate and write
          themeObj = generateThemeFromSeed(manifest?.bookId || id);
          try {
            await fs.writeFile(themeJsonPath, JSON.stringify(themeObj, null, 2), 'utf8');
            wroteTheme = true;
          } catch {}
        }
        // Update manifest in memory
        manifest.theme = themeObj;
        try {
          await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
          updatedManifest = true;
        } catch {}
      }
      updated.push({ id, wroteTheme, updatedManifest });
    }
    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e), updated }, { status: 500 });
  }
}


