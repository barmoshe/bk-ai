"use client";

import React from 'react';
import type { BookTheme } from '@/types/book';
import { cssVarsForTheme } from '@/lib/theme';

export default function BookThemeProvider({ theme, children }: { theme: BookTheme; children: React.ReactNode }) {
  const vars = cssVarsForTheme(theme);
  return (
    <div style={vars} data-theme={theme.id} className="book-theme">
      {children}
    </div>
  );
}


