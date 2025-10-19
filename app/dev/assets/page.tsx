'use client';
import { useState } from 'react';

export default function DevAssetsPage() {
  const [desc, setDesc] = useState('friendly fox');
  const [style, setStyle] = useState('storybook_watercolor');
  const [variants, setVariants] = useState(3);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dev: Asset Generator</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Description</label>
          <input className="border rounded px-3 py-2 w-full" value={desc} onChange={e => setDesc(e.target.value)} />
          <label className="block text-sm font-medium">Style</label>
          <select className="border rounded px-3 py-2 w-full" value={style} onChange={e => setStyle(e.target.value)}>
            <option value="storybook_watercolor">storybook_watercolor</option>
            <option value="flat_vector">flat_vector</option>
            <option value="soft_clay">soft_clay</option>
            <option value="soft_watercolor">soft_watercolor</option>
            <option value="bold_flat_shapes">bold_flat_shapes</option>
            <option value="crayon_paper_cut">crayon_paper_cut</option>
          </select>
          <label className="block text-sm font-medium">Variants (2-4)</label>
          <input type="number" min={2} max={4} className="border rounded px-3 py-2 w-full" value={variants} onChange={e => setVariants(Number(e.target.value))} />
          <button className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded">Generate</button>
        </div>
        <div className="md:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: variants }).map((_, i) => (
              <div key={i} className="border rounded overflow-hidden bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22><rect width=%2210%22 height=%2210%22 fill=%22%23ddd%22/><rect x=%2210%22 y=%2210%22 width=%2210%22 height=%2210%22 fill=%22%23ddd%22/></svg>')] aspect-square flex items-center justify-center text-sm text-gray-500">preview</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


