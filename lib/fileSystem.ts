/**
 * Unified file system architecture for book data
 * Consolidates legacy data/books structure with generated assets
 * Provides single source of truth for all book-related files
 */

import { promises as fs } from 'fs';
import path from 'path';

const BOOKS_DIR = process.env.BOOKS_DATA_DIR ?? './data/book';

export interface FileSystemPaths {
  root: string;
  manifest: string;
  printSpec: string;
  assets: {
    root: string;
    characters: string;
    decorations: string;
    backgrounds: string;
  };
  pages: {
    root: string;
    page: (pageIndex: number) => PagePaths;
  };
  prompts: string;
  cache: string;
}

export interface PagePaths {
  root: string;
  layout: string;
  content: string;
  illustration: string;
  renders: {
    root: string;
    screen: string;
    proof: string;
    print: string;
  };
}

export interface AssetPaths {
  root: string;
  raw: string;
  clean: string;
  meta: string;
}

/**
 * Get all paths for a book in the unified structure
 */
export function getBookPaths(bookId: string): FileSystemPaths {
  const root = path.join(BOOKS_DIR, bookId);
  
  return {
    root,
    manifest: path.join(root, 'manifest.json'),
    printSpec: path.join(root, 'print-spec.json'),
    assets: {
      root: path.join(root, 'assets'),
      characters: path.join(root, 'assets', 'characters'),
      decorations: path.join(root, 'assets', 'decorations'),
      backgrounds: path.join(root, 'assets', 'backgrounds'),
    },
    pages: {
      root: path.join(root, 'pages'),
      page: (pageIndex: number) => getPagePaths(root, pageIndex),
    },
    prompts: path.join(root, 'prompts'),
    cache: path.join(root, 'cache'),
  };
}

/**
 * Get paths for a specific page
 */
export function getPagePaths(bookRoot: string, pageIndex: number): PagePaths {
  const pageRoot = path.join(bookRoot, 'pages', String(pageIndex));
  const rendersRoot = path.join(pageRoot, 'renders');
  
  return {
    root: pageRoot,
    layout: path.join(pageRoot, 'layout.json'),
    content: path.join(pageRoot, 'content.json'),
    illustration: path.join(pageRoot, 'illustration.png'),
    renders: {
      root: rendersRoot,
      screen: path.join(rendersRoot, 'screen.jpg'),
      proof: path.join(rendersRoot, 'proof.jpg'),
      print: path.join(rendersRoot, 'print.jpg'),
    },
  };
}

/**
 * Get paths for a character or asset
 */
export function getAssetPaths(bookId: string, assetType: 'characters' | 'decorations' | 'backgrounds', assetId: string): AssetPaths {
  const bookPaths = getBookPaths(bookId);
  const assetRoot = path.join(bookPaths.assets[assetType], assetId);
  
  return {
    root: assetRoot,
    raw: path.join(assetRoot, 'raw.png'),
    clean: path.join(assetRoot, 'clean.png'),
    meta: path.join(assetRoot, 'meta.json'),
  };
}

/**
 * Ensure all directories exist for a book
 */
export async function ensureBookDirectories(bookId: string): Promise<void> {
  const paths = getBookPaths(bookId);
  
  await fs.mkdir(paths.root, { recursive: true });
  await fs.mkdir(paths.assets.characters, { recursive: true });
  await fs.mkdir(paths.assets.decorations, { recursive: true });
  await fs.mkdir(paths.assets.backgrounds, { recursive: true });
  await fs.mkdir(paths.pages.root, { recursive: true });
  await fs.mkdir(paths.prompts, { recursive: true });
  await fs.mkdir(paths.cache, { recursive: true });
}

/**
 * Ensure directories exist for a specific page
 */
export async function ensurePageDirectories(bookId: string, pageIndex: number): Promise<void> {
  const bookPaths = getBookPaths(bookId);
  const pagePaths = bookPaths.pages.page(pageIndex);
  
  await fs.mkdir(pagePaths.root, { recursive: true });
  await fs.mkdir(pagePaths.renders.root, { recursive: true });
}

/**
 * Ensure directories exist for an asset
 */
export async function ensureAssetDirectories(
  bookId: string,
  assetType: 'characters' | 'decorations' | 'backgrounds',
  assetId: string
): Promise<void> {
  const assetPaths = getAssetPaths(bookId, assetType, assetId);
  await fs.mkdir(assetPaths.root, { recursive: true });
}

/**
 * Save page render for a specific profile
 */
export async function savePageRender(
  bookId: string,
  pageIndex: number,
  profileType: 'screen' | 'proof' | 'print',
  jpegBuffer: Buffer
): Promise<string> {
  await ensurePageDirectories(bookId, pageIndex);
  const bookPaths = getBookPaths(bookId);
  const pagePaths = bookPaths.pages.page(pageIndex);
  const outputPath = pagePaths.renders[profileType];
  
  await fs.writeFile(outputPath, jpegBuffer);
  return outputPath;
}

/**
 * Read page render for a specific profile
 */
export async function readPageRender(
  bookId: string,
  pageIndex: number,
  profileType: 'screen' | 'proof' | 'print'
): Promise<Buffer> {
  const bookPaths = getBookPaths(bookId);
  const pagePaths = bookPaths.pages.page(pageIndex);
  const renderPath = pagePaths.renders[profileType];
  
  return await fs.readFile(renderPath);
}

/**
 * Check if a page render exists
 */
export async function pageRenderExists(
  bookId: string,
  pageIndex: number,
  profileType: 'screen' | 'proof' | 'print'
): Promise<boolean> {
  try {
    const bookPaths = getBookPaths(bookId);
    const pagePaths = bookPaths.pages.page(pageIndex);
    const renderPath = pagePaths.renders[profileType];
    await fs.access(renderPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save asset (character, decoration, background)
 */
export async function saveAsset(
  bookId: string,
  assetType: 'characters' | 'decorations' | 'backgrounds',
  assetId: string,
  variant: 'raw' | 'clean',
  data: Buffer
): Promise<string> {
  await ensureAssetDirectories(bookId, assetType, assetId);
  const assetPaths = getAssetPaths(bookId, assetType, assetId);
  const outputPath = assetPaths[variant];
  
  await fs.writeFile(outputPath, data);
  return outputPath;
}

/**
 * Save asset metadata
 */
export async function saveAssetMeta(
  bookId: string,
  assetType: 'characters' | 'decorations' | 'backgrounds',
  assetId: string,
  metadata: object
): Promise<string> {
  await ensureAssetDirectories(bookId, assetType, assetId);
  const assetPaths = getAssetPaths(bookId, assetType, assetId);
  
  await fs.writeFile(assetPaths.meta, JSON.stringify(metadata, null, 2), 'utf8');
  return assetPaths.meta;
}

/**
 * Read asset
 */
export async function readAsset(
  bookId: string,
  assetType: 'characters' | 'decorations' | 'backgrounds',
  assetId: string,
  variant: 'raw' | 'clean'
): Promise<Buffer> {
  const assetPaths = getAssetPaths(bookId, assetType, assetId);
  return await fs.readFile(assetPaths[variant]);
}

/**
 * List all pages for a book
 */
export async function listBookPages(bookId: string): Promise<number[]> {
  const bookPaths = getBookPaths(bookId);
  
  try {
    const dirs = await fs.readdir(bookPaths.pages.root);
    const pageIndices = dirs
      .map(dir => parseInt(dir, 10))
      .filter(num => !isNaN(num))
      .sort((a, b) => a - b);
    
    return pageIndices;
  } catch {
    return [];
  }
}

/**
 * Copy file with error handling
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  const dir = path.dirname(dest);
  await fs.mkdir(dir, { recursive: true });
  await fs.copyFile(src, dest);
}

/**
 * Backward compatibility: get legacy page path
 * Use this to migrate from old structure
 */
export function getLegacyPagePath(bookId: string, pageIndex: number): string {
  return path.join(BOOKS_DIR, bookId, 'pages', String(pageIndex), 'page.jpg');
}

/**
 * Backward compatibility: get legacy print path
 */
export function getLegacyPrintPath(bookId: string, pageIndex: number): string {
  return path.join(BOOKS_DIR, bookId, 'pages', String(pageIndex), 'page-print.jpg');
}

