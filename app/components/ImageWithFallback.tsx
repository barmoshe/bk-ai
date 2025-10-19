"use client";

import React, { useState } from 'react';

export default function ImageWithFallback({
  src,
  alt,
  className,
  aspectRatio,
  sizes,
  previewSrc,
  fallbackSrc,
  objectFit,
}: {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string; // e.g., '4 / 3'
  sizes?: string; // for responsive hints
  previewSrc?: string;
  fallbackSrc?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const fitClass = objectFit === 'contain'
    ? 'object-contain'
    : objectFit === 'fill'
    ? 'object-fill'
    : objectFit === 'none'
    ? 'object-none'
    : objectFit === 'scale-down'
    ? 'object-scale-down'
    : 'object-cover';

  return (
    <div className={className} style={aspectRatio ? ({ aspectRatio } as any) : undefined}>
      {previewSrc && (
        <img
          src={previewSrc}
          alt={alt}
          className={`w-full h-full ${fitClass} ${loaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 blur-sm`}
          aria-hidden
        />
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={`w-full h-full ${fitClass} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (fallbackSrc && currentSrc !== fallbackSrc) {
            // Switch to fallback and mark as loaded to hide preview blur
            setCurrentSrc(fallbackSrc);
            setLoaded(true);
          }
        }}
      />
    </div>
  );
}


