import React from 'react';
import type { LayoutOption } from '@/types/book';
import { cssAspect } from '@/lib/theme';

interface PageLayoutProps {
  imagePlacement: LayoutOption;
  aspectRatio: '4:3' | '3:2' | '1:1';
  gutter?: number;
  image: React.ReactNode;
  text: React.ReactNode;
}

export default function PageLayout({ imagePlacement, aspectRatio, gutter = 20, image, text }: PageLayoutProps) {
  const aspectStyle: React.CSSProperties = { aspectRatio: cssAspect(aspectRatio) } as any;

  const commonImageClass = 'rounded-2xl shadow-xl overflow-hidden bg-white';

  if (imagePlacement === 'imageTop') {
    return (
      <div className="flex flex-col gap-6 w-full">
        <div className={commonImageClass} style={aspectStyle}>{image}</div>
        <div>{text}</div>
      </div>
    );
  }

  if (imagePlacement === 'imageLeft') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6 w-full">
        <div className={commonImageClass} style={aspectStyle}>{image}</div>
        <div style={{ paddingLeft: gutter }}>{text}</div>
      </div>
    );
  }

  // imageRight
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6 w-full">
      <div className="order-2 md:order-none" style={{ paddingRight: gutter }}>{text}</div>
      <div className={commonImageClass} style={aspectStyle}>{image}</div>
    </div>
  );
}


