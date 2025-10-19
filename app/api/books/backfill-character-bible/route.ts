import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.env.BOOKS_DATA_DIR ?? './data/book';

export async function POST(req: NextRequest) {
  const updated: Array<{ id: string; wroteBible: boolean }> = [];
  try {
    const dirs = await fs.readdir(ROOT, { withFileTypes: true });
    for (const dirent of dirs) {
      if (!dirent.isDirectory()) continue;
      const id = dirent.name;
      const bookRoot = path.join(ROOT, id);
      const manifestPath = path.join(bookRoot, 'manifest.json');
      const biblePath = path.join(bookRoot, 'character.json');
      let wroteBible = false;
      try {
        // Skip if already exists
        await fs.access(biblePath);
        updated.push({ id, wroteBible: false });
        continue;
      } catch {}

      // Infer from manifest and first page/prompt
      let species = '';
      const physicalDescriptors: string[] = [];
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const man = JSON.parse(raw);
        const name: string = String(man?.character?.name || man?.characterSet?.[0]?.name || '').toLowerCase();
        if (/dog/.test(name)) species = 'dog';
        // Try first pages prompt
        try {
          const p1 = path.join(bookRoot, 'prompts', 'image-page-1-request.json');
          const pr = JSON.parse(await fs.readFile(p1, 'utf8'));
          const prompt: string = String(pr?.prompt || '').toLowerCase();
          if (!species && /dog/.test(prompt)) species = 'dog';
          if (/floppy/.test(prompt)) physicalDescriptors.push('floppy ears');
          if (/short tail/.test(prompt)) physicalDescriptors.push('short tail');
        } catch {}
      } catch {}

      const bible = {
        species: species || 'human',
        physicalDescriptors,
        silhouetteMarkers: physicalDescriptors.filter(d => /(ear|tail)/.test(d)),
        palette: [],
        signatureProps: [],
      };
      try {
        await fs.writeFile(biblePath, JSON.stringify(bible, null, 2), 'utf8');
        wroteBible = true;
      } catch {}
      updated.push({ id, wroteBible });
    }
    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


