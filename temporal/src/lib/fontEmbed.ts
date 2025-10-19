import { promises as fs } from 'fs';
import path from 'path';
import { FontStack, getPublicFontPath } from './styleFonts';

function toDataUrlFont(buf: Buffer): string {
  const base64 = buf.toString('base64');
  return `data:font/woff2;base64,${base64}`;
}

async function tryRead(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Build @font-face CSS for provided family and weight→file map.
 * Returns empty string if no files are found; callers should provide system fallbacks.
 */
export async function buildEmbeddedFontCss(
  familyName: string,
  files: Record<string, string>
): Promise<string> {
  const entries = Object.entries(files);
  const rules: string[] = [];
  for (const [weight, file] of entries) {
    const abs = getPublicFontPath(file);
    const buf = await tryRead(abs);
    if (!buf) continue;
    const src = toDataUrlFont(buf);
    rules.push(`@font-face{font-family:'${familyName}';src:url('${src}') format('woff2');font-weight:${weight};font-style:normal;font-display:swap;}`);
  }
  return rules.join('');
}

/**
 * Convenience: build embedded CSS for a FontStack if it has assets. Returns empty string if none.
 */
export async function buildEmbeddedCssFromStack(stack: FontStack): Promise<string> {
  if (!stack.assets) return '';
  return buildEmbeddedFontCss(stack.assets.familyName, stack.assets.files);
}


