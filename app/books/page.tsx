import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import BookCoverImage from '../components/BookCoverImage';

const ROOT = process.env.BOOKS_DATA_DIR ?? './data/book';

async function getBooks() {
  try {
    const dirs = await fs.readdir(ROOT);
    const books = await Promise.all(
      dirs.map(async id => {
        try {
          const manifestPath = path.join(ROOT, id, 'manifest.json');
          const stat = await fs.stat(manifestPath);
          const manifestRaw = await fs.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestRaw);
          
          // Try to get first page image (prefer print version, fallback to regular jpeg or preview)
          let coverImage = null;
          if (manifest.pages && manifest.pages.length > 0) {
            const firstPage = manifest.pages[0];
            // Priority: jpegPrintPath > jpegPath > preview.jpg > pngPath
            if (firstPage.jpegPrintPath) {
              // Strip 'data/book/' prefix since Next.js /data route already points to data/book
              const pathWithoutPrefix = firstPage.jpegPrintPath.replace(/^data\/book\//, '');
              coverImage = `/data/${pathWithoutPrefix}`;
            } else if (firstPage.jpegPath) {
              const pathWithoutPrefix = firstPage.jpegPath.replace(/^data\/book\//, '');
              coverImage = `/data/${pathWithoutPrefix}`;
            } else if (firstPage.pageIndex) {
              // Try preview.jpg as fallback
              coverImage = `/data/${id}/pages/${firstPage.pageIndex}/preview.jpg`;
            }
          }
          
          return {
            id,
            title: manifest.title ?? id,
            createdAt: stat.mtimeMs,
            pageCount: manifest.pages?.length ?? 0,
            character: manifest.character?.name,
            topic: manifest.prefs?.topic,
            coverImage,
          };
        } catch {
          return null;
        }
      }),
    );
    return books.filter(Boolean) as Array<{
      id: string;
      title: string;
      createdAt: number;
      pageCount: number;
      character?: string;
      topic?: string;
      coverImage: string | null;
    }>;
  } catch {
    return [];
  }
}

export default async function BooksPage() {
  const books = await getBooks();
  
  return (
    <div className='mx-auto max-w-6xl'>
      <div className='mb-8 flex items-center justify-between'>
        <div>
          <h1 className='mb-2 text-4xl font-bold text-gray-900'>📚 My Books</h1>
          <p className='text-gray-600'>
            {books.length > 0 ? `${books.length} book${books.length === 1 ? '' : 's'} created` : 'No books yet'}
          </p>
        </div>
        <Link href='/new' className='btn-primary'>
          ➕ Create New Book
        </Link>
      </div>

      {books.length === 0 ? (
        <Card className='text-center py-12'>
          <div className='text-6xl mb-4'>📖</div>
          <h2 className='text-2xl font-bold text-gray-900 mb-2'>No Books Yet</h2>
          <p className='text-gray-600 mb-6 max-w-md mx-auto'>
            Start creating your first personalized children's book with AI!
          </p>
          <Link href='/new' className='btn-primary inline-block'>
            ✨ Create Your First Book
          </Link>
        </Card>
      ) : (
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {books.map(book => (
            <Link key={book.id} href={`/book/${book.id}`}>
              <Card className='h-full transition-all duration-300 hover:scale-105 p-0 overflow-hidden'>
                <BookCoverImage src={book.coverImage} alt={book.title} />
                <div className='p-4'>
                  <h3 className='font-bold text-lg text-gray-900 mb-2 line-clamp-2'>
                    {book.title}
                  </h3>
                  <div className='flex flex-wrap gap-2 mb-3'>
                    <Badge variant='primary'>{book.pageCount} pages</Badge>
                    {book.character && <Badge variant='neutral'>👤 {book.character}</Badge>}
                  </div>
                  {book.topic && (
                    <p className='text-sm text-gray-600 mb-3 line-clamp-1'>
                      About: {book.topic}
                    </p>
                  )}
                  <p className='text-xs text-gray-500'>
                    Created {new Date(book.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function BooksPageSkeleton() {
  return (
    <div className='mx-auto max-w-6xl'>
      <div className='mb-8'>
        <Skeleton className='h-10 w-48 mb-2' />
        <Skeleton className='h-6 w-32' />
      </div>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
        {[...Array(6)].map((_, i) => (
          <Card key={i} className='p-0'>
            <Skeleton className='w-full aspect-video' />
            <div className='p-4'>
              <Skeleton className='h-6 w-3/4 mb-2' />
              <Skeleton className='h-4 w-1/2 mb-3' />
              <Skeleton className='h-3 w-full mb-2' />
              <Skeleton className='h-3 w-2/3' />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}






