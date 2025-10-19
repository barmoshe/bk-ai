'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BookSlider from '@/app/components/BookSlider';
import BookThemeProvider from '@/app/components/BookThemeProvider';
import { generateThemeFromSeed } from '@/lib/theme';
import type { BookTheme } from '@/types/book';

interface Page {
  pageIndex: number;
  text?: string;
  formatted?: { lines: string[] };
  layout?: string;
}

interface PageData {
  pageIndex: number;
  text: string;
  imagePrompt: string;
  layout: string;
  imageUrl: string;
  formatted?: { lines: string[] };
}

interface Manifest {
  bookId: string;
  title: string;
  pages: { pageIndex: number; textPath?: string }[];
}

export default function PreviewBookPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<BookTheme | null>(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    async function loadManifest() {
      try {
        const response = await fetch(`/data/${params.id}/manifest.json`);
        if (!response.ok) {
          throw new Error('Failed to load book');
        }
        const data = await response.json();
        setManifest(data);

        // Theme: use manifest theme if present, else generate from seed (bookId)
        try {
          const t = data?.theme ?? generateThemeFromSeed(data?.bookId || params.id);
          setTheme(t);
        } catch {}

        // Mirror typography choices to UI via CSS variables when available
        try {
          const stylePackId = data?.stylePackId;
          if (stylePackId) {
            const root = document.documentElement;
            // Pick reasonable families aligned with layout.tsx font variables
            if (stylePackId === 'storybook_watercolor' || stylePackId === 'soft_watercolor') {
              root.style.setProperty('--font-body', `var(--font-lora), Lora, Georgia, 'Iowan Old Style', 'Apple Garamond', Baskerville, 'Times New Roman', 'Droid Serif', Times, serif`);
            } else if (stylePackId === 'flat_vector' || stylePackId === 'soft_clay') {
              root.style.setProperty('--font-body', `var(--font-nunito), Nunito, var(--font-body-var), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`);
            } else if (stylePackId === 'bold_flat_shapes' || stylePackId === 'crayon_paper_cut') {
              root.style.setProperty('--font-body', `var(--font-mplus-rounded), 'M PLUS Rounded 1c', var(--font-nunito), Nunito, var(--font-body-var), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`);
            }
          }
          // Lock preview font size across pages for on-screen parity with print
          document.documentElement.style.setProperty('--font-body-size', '18px');
          document.documentElement.style.setProperty('--font-line-height', '1.6');
        } catch {}

        // Load page text for each page
        const pagesWithText = await Promise.all(
          data.pages.map(async (page: { pageIndex: number }) => {
            try {
              const pageResponse = await fetch(`/data/${params.id}/pages/${page.pageIndex}/page.json`);
              if (pageResponse.ok) {
                const pageData: PageData = await pageResponse.json();
                return {
                  pageIndex: page.pageIndex,
                  text: pageData.text,
                  formatted: pageData.formatted,
                  layout: pageData.layout,
                };
              }
            } catch {
              // If page data fails to load, continue without text
            }
            return {
              pageIndex: page.pageIndex,
              text: undefined,
            };
          })
        );

        setPages(pagesWithText);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load book');
      } finally {
        setLoading(false);
      }
    }

    loadManifest();
  }, [params.id]);

  const handleClose = () => {
    router.push(`/book/${params.id}`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-pink-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-16 h-16 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading book...</p>
        </div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-pink-900 to-blue-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-white text-2xl font-bold mb-2">Unable to Load Book</h2>
          <p className="text-white/80 mb-6">{error || 'Book not found'}</p>
          <button
            onClick={handleClose}
            className="btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const content = (
    <BookSlider
      bookId={params.id}
      pages={pages}
      title={manifest.title}
      onClose={handleClose}
      aspectRatio={theme?.image.aspectRatio}
      printMode={printMode}
      onTogglePrintMode={() => setPrintMode(v => !v)}
    />
  );

  return theme ? (
    <BookThemeProvider theme={theme}>
      <div className={printMode ? 'bg-white' : ''}>
        {content}
      </div>
    </BookThemeProvider>
  ) : content;
}

