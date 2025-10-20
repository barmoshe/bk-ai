"use client";

import React from 'react';

export default function BookCoverImage({ 
  src, 
  alt 
}: { 
  src: string | null; 
  alt: string;
}) {
  return (
    <div className='w-full aspect-[16/9] bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center relative overflow-hidden'>
      {src ? (
        <>
          <img
            src={src}
            alt={alt}
            className='w-full h-full object-cover absolute inset-0 z-20'
            onError={(e) => {
              // Hide image on error, show fallback background
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className='text-6xl relative z-10'>📖</span>
        </>
      ) : (
        <span className='text-6xl relative z-10'>📖</span>
      )}
    </div>
  );
}

