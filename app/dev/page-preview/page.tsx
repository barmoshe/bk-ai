'use client';
import { useState } from 'react';

export default function DevPagePreview() {
  const [text, setText] = useState('Once upon a time...');
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dev: Page Preview</h1>
      <textarea className="border rounded w-full p-3" rows={6} value={text} onChange={e => setText(e.target.value)} />
      <div className="aspect-video border rounded bg-white grid place-items-center text-gray-500">
        live composition (hooked via server later)
      </div>
    </div>
  );
}


