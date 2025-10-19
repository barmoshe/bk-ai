import { readFile } from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { Suspense } from 'react';
import React from 'react';
import ImageWithFallback from '@/app/components/ImageWithFallback';
import BookThemeProvider from '@/app/components/BookThemeProvider';
import { generateThemeFromSeed } from '@/lib/theme';
import type { BookTheme } from '@/types/book';

export default async function BookPage({ params }: { params: { id: string } }) {
  const ROOT = process.env.BOOKS_DATA_DIR ?? './data/book';
  const manifestPath = path.join(ROOT, params.id, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as any;
  const theme: BookTheme = manifest?.theme ?? generateThemeFromSeed(manifest?.bookId || params.id);
  // Read bible if present
  let bible: any = null;
  try {
    const biblePath = path.join(ROOT, params.id, 'character.json');
    bible = JSON.parse(await readFile(biblePath, 'utf8'));
  } catch {}

  return (
    <BookThemeProvider theme={theme}>
    <div className='mx-auto max-w-6xl'>
      <div className='mb-8 text-center'>
        <div className='mb-4 inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-1 text-sm font-semibold text-white'>
          ✨ Book Complete!
        </div>
        <h1 className='mb-3 text-4xl font-bold text-gray-900'>{manifest.title}</h1>
        <p className='mb-6 text-gray-600'>
          A {manifest.prefs.tone} story about {manifest.prefs.topic} for ages{' '}
          {manifest.prefs.targetAge}+
        </p>
        <div className='flex gap-3 justify-center'>
          <Link href={`/preview-book/${params.id}`} className='btn-primary inline-block'>
            📖 Read Book
          </Link>
          <a href={`/api/books/${params.id}/pdf`} className='btn-primary inline-block' download>
            📥 Download PDF
          </a>
          <Link href='/new' className='btn-secondary inline-block'>
            📚 Create Another Book
          </Link>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        {manifest.pages.map((p: any) => (
          <div key={p.pageIndex} className='card group'>
            <div className='relative mb-4 overflow-hidden rounded-xl bg-gradient-to-br from-purple-50 to-pink-50'>
              <ImageWithFallback
                src={`/data/${params.id}/pages/${p.pageIndex}/page-print.jpg`}
                fallbackSrc={`/data/${params.id}/pages/${p.pageIndex}/page.jpg`}
                alt={`Page ${p.pageIndex}`}
                className='h-auto w-full aspect-video object-cover'
              />
              <div className='absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-purple-700 backdrop-blur-sm'>
                Page {p.pageIndex}
              </div>
            </div>
            <div className='flex flex-wrap gap-2'>
              <a
                className='flex-1 rounded-lg bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100 hover:text-purple-900'
                href={`/data/${params.id}/pages/${p.pageIndex}/page.json`}
                download>
                📄 JSON
              </a>
              <a
                className='flex-1 rounded-lg bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100 hover:text-purple-900'
                href={`/data/${params.id}/pages/${p.pageIndex}/illustration.png`}
                download>
                🖼️ PNG
              </a>
              <a
                className='flex-1 rounded-lg bg-purple-50 px-3 py-2 text-center text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100 hover:text-purple-900'
                href={`/data/${params.id}/pages/${p.pageIndex}/page-print.jpg`}
                download>
                📸 JPG (Print)
              </a>
            </div>
            <div className='mt-2 flex items-center justify-end'>
              <div className='text-xs text-gray-500'>16:9</div>
            </div>
            {/* continuity summary if available */}
            <div className='mt-2'>
              <a className='text-xs text-blue-600 hover:underline' href={`/data/${params.id}/pages/${p.pageIndex}/continuity.json`}>
                continuity.json
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className='card mt-8 bg-gradient-to-br from-purple-50 to-pink-50'>
        <h3 className='mb-3 text-lg font-bold text-gray-900'>📦 Download All Files</h3>
        <p className='mb-4 text-sm text-gray-600'>
          All your book files are saved in:{' '}
          <code className='rounded bg-white px-2 py-1 text-xs'>data/book/{params.id}/</code>
        </p>
        <div className='flex gap-3'>
          <a href={`/data/${params.id}/manifest.json`} download className='btn-secondary text-sm'>
            📋 Download Manifest
          </a>
          {bible ? (
            <a href={`/data/${params.id}/character.json`} download className='btn-secondary text-sm'>
              🧬 Character Bible
            </a>
          ) : null}
        </div>
      </div>
    </div>
    </BookThemeProvider>
  );
}
