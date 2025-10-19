'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateFlowState } from '../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import ImageWithFallback from '../../components/ImageWithFallback';
import { useSSE } from '../../lib/useSSE';
import BookThemeProvider from '../../components/BookThemeProvider';
import { generateThemeFromSeed } from '@/lib/theme';
import type { BookTheme } from '@/types/book';
import type { LayoutOption } from '@/types/book';

interface Step5CoversProps {
  state: CreateFlowState;
  updateState: (updates: Partial<CreateFlowState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const LOADING_MESSAGES = [
  { emoji: '🎨', text: 'Painting your cover options...' },
  { emoji: '✨', text: 'Adding magical typography...' },
  { emoji: '🖌️', text: 'Mixing perfect colors...' },
  { emoji: '📚', text: 'Almost ready! Final touches...' },
];

export default function Step5Covers({ state, updateState, onNext, onBack }: Step5CoversProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    state.selectedCoverOptionId || null
  );
  const [error, setError] = useState<string | null>(null);
  const theme: BookTheme = (state as any).theme || generateThemeFromSeed(state.bookId || `${state.createdAt}`);

  // Get cover options from workflow progress
  const coverOptions = (state.progress as any)?.coverOptions || [];
  const isGenerating = coverOptions.length === 0;

  // Subscribe to workflow state updates if not already connected
  useSSE(state.workflowId ? `/api/workflows/progress/${state.workflowId}` : null, (data: any) => {
    updateState({ progress: data });
  });

  // Cycle loading messages
  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  const handleSelectCover = async (optionId: string) => {
    if (!state.bookId) return;
    setSelectedOptionId(optionId);

    try {
      await fetch('/api/workflows/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: state.bookId,
          type: 'selectCover',
          payload: optionId,
        }),
      });

      updateState({ selectedCoverOptionId: optionId });
    } catch (err) {
      console.error('Error selecting cover:', err);
      setError('Failed to select cover. Please try again.');
      setSelectedOptionId(null);
    }
  };

  const handleContinue = () => {
    if (selectedOptionId) {
      onNext();
    }
  };

  // Loading state
  if (isGenerating) {
    return (
      <div className='max-w-4xl mx-auto'>
        <Card className='text-center py-16'>
          <AnimatePresence mode='wait'>
            <motion.div
              key={messageIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <div className='text-8xl mb-6'>{LOADING_MESSAGES[messageIndex].emoji}</div>
              <h2 className='text-3xl font-bold text-gray-900 mb-4'>
                Creating Your Cover Options...
              </h2>
              <p className='text-xl text-gray-600 mb-8'>
                {LOADING_MESSAGES[messageIndex].text}
              </p>
            </motion.div>
          </AnimatePresence>

          <Spinner size='lg' className='mx-auto mb-8' />

          <div className='space-y-4'>
            <p className='text-sm text-gray-500'>
              This usually takes about 20-30 seconds...
            </p>
            <Button variant='ghost' onClick={onBack} size='sm'>
              ← Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Cover selection
  return (
    <div className='max-w-6xl mx-auto'>
      {/* Theme Preview & Layout Choice */}
      <Card className='mb-8'>
        <div className='flex flex-col md:flex-row items-start gap-6'>
          <div className='flex-1'>
            <h3 className='text-lg font-bold text-gray-900 mb-2'>Theme Preview</h3>
            <p className='text-sm text-gray-600 mb-4'>Each book has a unique theme (colors and fonts). You can reroll if you want a different vibe.</p>
            <div className='flex gap-3'>
              <Button variant='secondary' onClick={() => updateState({ theme: generateThemeFromSeed(`${state.bookId || state.createdAt}-${Math.random().toString(36).slice(2,8)}`) as any })}>↻ Reroll Theme</Button>
              <Button variant='ghost' onClick={() => updateState({ theme })}>Use This Theme</Button>
            </div>
          </div>
          <div className='w-full md:w-96'>
            <BookThemeProvider theme={theme}>
              <div className='rounded-2xl border p-4' style={{ background: 'var(--color-bg)' }}>
                <div className='text-sm font-medium mb-2' style={{ color: 'var(--color-text)' }}>Palette</div>
                <div className='flex gap-2 mb-4'>
                  {['primary','secondary','accent','muted'].map((k) => (
                    <div key={k} className='h-8 w-8 rounded-lg border' style={{ background: `var(--color-${k})` }} title={k}></div>
                  ))}
                </div>
                <div className='text-sm font-medium mb-1' style={{ color: 'var(--color-text)' }}>Fonts</div>
                <div className='space-y-1'>
                  <div style={{ fontFamily: 'var(--font-heading)' }} className='text-lg'>Heading ABC</div>
                  <div style={{ fontFamily: 'var(--font-body)' }} className='text-sm'>Body text sample for preview purposes.</div>
                </div>
              </div>
            </BookThemeProvider>
          </div>
        </div>
        <div className='mt-6'>
          <div className='text-sm font-semibold text-gray-800 mb-2'>Default Page Layout</div>
          <div className='flex gap-3'>
            {([
              { id: 'imageLeft', label: 'Image Left' },
              { id: 'imageRight', label: 'Image Right' },
              { id: 'imageTop', label: 'Image Top' },
            ] as { id: LayoutOption; label: string }[]).map(opt => (
              <Button key={opt.id} variant={(theme.layout?.imagePlacement || 'imageTop') === opt.id ? 'primary' : 'secondary'} onClick={() => updateState({ theme: { ...(theme as any), layout: { ...(theme.layout || {}), imagePlacement: opt.id } } as any })}>
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>
      <motion.div
        className='text-center mb-12'
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className='text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'>
          Choose Your Perfect Cover 📚
        </h1>
        <p className='text-xl text-gray-600'>
          Pick the cover that will make your story shine!
        </p>
      </motion.div>

      {error && (
        <div className='mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-center'>
          {error}
        </div>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mb-8'>
        {coverOptions.map((option: any, index: number) => (
          <motion.div
            key={option.optionId}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={`cursor-pointer transition-all duration-300 p-0 overflow-hidden ${
                selectedOptionId === option.optionId
                  ? 'ring-4 ring-purple-500 shadow-2xl'
                  : 'hover:shadow-xl hover:scale-105'
              }`}
              onClick={() => handleSelectCover(option.optionId)}
            >
              <div className='relative aspect-[3/4] bg-gray-100'>
                <ImageWithFallback
                  src={`/data/${state.bookId}/cover/options/${option.fileName}`}
                  alt={`Cover option ${index + 1}`}
                  className='w-full h-full object-cover'
                />
                {selectedOptionId === option.optionId && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className='absolute top-4 right-4 bg-purple-500 text-white px-4 py-2 rounded-full font-bold shadow-lg'
                  >
                    ⭐ Your Choice!
                  </motion.div>
                )}
              </div>
              <div className='p-6 text-center'>
                <Button
                  className='w-full'
                  variant={selectedOptionId === option.optionId ? 'primary' : 'secondary'}
                >
                  {selectedOptionId === option.optionId ? '✓ Selected' : '✨ Choose This One'}
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className='flex gap-4 justify-center'>
        <Button variant='secondary' onClick={onBack}>
          ← Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedOptionId}
          size='lg'
          className='min-w-64'
        >
          {selectedOptionId ? 'Continue to Magic ✨ →' : 'Select a cover first'}
        </Button>
      </div>
    </div>
  );
}

