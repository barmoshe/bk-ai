import { promises as fs } from 'fs';
import path from 'path';

export const BOOKS_DIR = process.env.BOOKS_DATA_DIR ?? './data/book';

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeJSON(filePath: string, value: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export async function writeBuffer(filePath: string, buf: Buffer) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, buf);
}

export async function readJSON<T>(filePath: string): Promise<T> {
  const txt = await fs.readFile(filePath, 'utf8');
  return JSON.parse(txt) as T;
}

export async function listFiles(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function copyFile(src: string, dest: string) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

export function bookRoot(bookId: string) {
  return path.join(BOOKS_DIR, bookId);
}

export function bookCharactersOptionsDir(bookId: string) {
  return path.join(bookRoot(bookId), 'characters', 'options');
}

