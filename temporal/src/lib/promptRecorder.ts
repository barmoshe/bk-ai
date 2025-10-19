import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../shared';

const BOOKS_DIR = config.booksDataDir;

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function saveArtifact(
  bookId: string,
  filename: string,
  data: any,
): Promise<string> {
  try {
    const promptsDir = path.join(BOOKS_DIR, bookId, 'prompts');
    await ensureDir(promptsDir);
    const outPath = path.join(promptsDir, filename);
    await fs.writeFile(outPath, JSON.stringify(data, null, 2), 'utf8');
    return outPath;
  } catch {
    return '';
  }
}

export interface PromptRunRecord {
  step: string;
  version?: string;
  model: string;
  temperature?: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  input: any;
  output?: any;
  meta?: Record<string, any>;
}

export async function recordPromptRun(
  bookId: string,
  name: string,
  record: PromptRunRecord,
): Promise<void> {
  try {
    const promptsDir = path.join(BOOKS_DIR, bookId, 'prompts');
    await ensureDir(promptsDir);
    const outPath = path.join(promptsDir, `${name}.json`);
    await fs.writeFile(outPath, JSON.stringify(record, null, 2), 'utf8');
  } catch {
    // best-effort
  }
}


