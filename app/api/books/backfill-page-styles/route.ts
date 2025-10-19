import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.env.BOOKS_DATA_DIR ?? './data/book';

export async function POST(req: NextRequest) {
  try {
    const { bookId, overwrite } = await req.json().catch(() => ({}));
    const books: string[] = [];
    if (bookId) {
      books.push(String(bookId));
    } else {
      const entries = await fs.readdir(ROOT, { withFileTypes: true });
      for (const e of entries) if (e.isDirectory()) books.push(e.name);
    }

    const updated: Array<{ id: string; pages: number; wrote: number }> = [];

    for (const id of books) {
      const bookRoot = path.join(ROOT, id);
      let manifest: any = null;
      try {
        manifest = JSON.parse(await fs.readFile(path.join(bookRoot, 'manifest.json'), 'utf8'));
      } catch {
        continue;
      }
      const pages = manifest?.pages || [];
      let wrote = 0;
      for (const p of pages) {
        const pageDir = path.join(bookRoot, 'pages', String(p.pageIndex));
        const stylePath = path.join(pageDir, 'style.json');
        const exists = await fs
          .access(stylePath)
          .then(() => true)
          .catch(() => false);
        if (exists && !overwrite) continue;
        try {
          await fs.mkdir(pageDir, { recursive: true });
          const baseline = {
            palette: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#6A4C93'],
            layoutStyle: p.layout || 'imageTop',
            background: { kind: 'solid', color: '#ffffff' },
            saturationBoost: 0.15,
          };
          await fs.writeFile(stylePath, JSON.stringify(baseline, null, 2), 'utf8');
          wrote += 1;
        } catch {}
      }
      updated.push({ id, pages: pages.length, wrote });
    }

    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


