import React from 'react';

export function smarten(text: string): string {
  // Simple smart quotes and dashes
  return text
    .replace(/\s-\s/g, '  ') // em dash
    .replace(/(^|\W)"(\S)/g, '$1$2') // opening double
    .replace(/(\S)"(\W|$)/g, '$1$2') // closing double
    .replace(/(^|\W)'(\S)/g, '$1$2') // opening single
    .replace(/(\S)'(\W|$)/g, '$1$2') // closing single
    .replace(/[\u001c\u001d\u0018\u0019]/g, (m) =>
      m === '\u001c' ? '“' : m === '\u001d' ? '”' : m === '\u0018' ? '‘' : '’'
    );
}

export function TextBlock({ lines, compact = false }: { lines: string[]; compact?: boolean }) {
  return (
    <div className={compact ? 'tb tb-compact' : 'tb'} style={{ hyphens: 'auto' as any }}>
      {lines.map((line, idx) => (
        <p
          key={idx}
          className="tb-line"
          style={{ textWrap: 'balance' as any, fontVariantLigatures: 'common-ligatures', fontOpticalSizing: 'auto' as any }}
        >
          {smarten(line)}
        </p>
      ))}
    </div>
  );
}
