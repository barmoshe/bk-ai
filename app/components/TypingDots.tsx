'use client';

import React from 'react';

export default function TypingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label="AI is typing">
      <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.2s]" />
      <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
      <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:0.2s]" />
    </span>
  );
}


