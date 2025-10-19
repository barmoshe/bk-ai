import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.env.BOOKS_DATA_DIR ?? './data/book';

export async function GET() {
  try {
    const dirs = await fs.readdir(ROOT);
    const books = (
      await Promise.all(
        dirs.map(async id => {
          try {
            const manifestPath = path.join(ROOT, id, 'manifest.json');
            const stat = await fs.stat(manifestPath);
            const manifestRaw = await fs.readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestRaw);
            return { id, title: manifest.title ?? id, createdAt: stat.mtimeMs };
          } catch {
            return null;
          }
        }),
      )
    ).filter(Boolean);
    return Response.json({ books });
  } catch {
    return Response.json({ books: [] });
  }
}










