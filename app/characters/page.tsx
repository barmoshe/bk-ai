'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CharactersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get('bookId') as string;
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFiles() {
      try {
        const res = await fetch(`/api/characters/list?bookId=${bookId}`);
        if (res.ok) {
          const data = await res.json();
          setFiles(data.files || []);
        }
      } catch (error) {
        console.error('Error loading files:', error);
      } finally {
        setLoading(false);
      }
    }
    loadFiles();
  }, [bookId]);

  async function choose(filename: string) {
    try {
      await fetch('/api/workflows/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, type: 'chooseCharacter', payload: filename }),
      });
      router.push(`/prefs?bookId=${bookId}`);
    } catch (error) {
      alert('Error selecting character. Please try again.');
    }
  }

  if (loading || files.length === 0) {
    return (
      <div className='mx-auto max-w-2xl'>
        <div className='mb-4'>
          <span className='text-sm text-gray-600'>Step 2 of 5</span>
        </div>
        <div className='card text-center'>
          <div className='mb-4'>
            <svg
              className='mx-auto h-12 w-12 animate-spin text-purple-600'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'>
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'></circle>
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
            </svg>
          </div>
          <h2 className='mb-2 text-2xl font-bold text-gray-900'>Generating Character Options...</h2>
          <p className='text-gray-600'>
            Our AI is creating beautiful character illustrations for you. This may take a minute.
          </p>
          <button onClick={() => window.location.reload()} className='btn-secondary mt-6'>
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-5xl'>
      <div className='mb-2'>
        <span className='text-sm text-gray-600'>Step 2 of 5</span>
      </div>
      <div className='mb-8 text-center'>
        <h1 className='mb-2 text-3xl font-bold text-gray-900'>Choose Your Character</h1>
        <p className='text-gray-600'>Select the character design you love most for your story</p>
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        {files.map(f => (
          <div key={f} className='card group transition-transform duration-200 hover:scale-105'>
            <div className='mb-4 aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-purple-100 to-pink-100'>
              <img
                alt={f}
                src={`/data/${bookId}/characters/options/${f}`}
                className='h-full w-full object-cover'
              />
            </div>
            <button className='btn-primary w-full' onClick={() => choose(f)} type='button'>
              ✨ Select This Character
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
