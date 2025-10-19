'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CreateFlowState } from '../types';
import { WorkflowState, PageArtifactState } from '../../../temporal/src/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useSSE } from '../../lib/useSSE';

interface Step5MagicProps {
  state: CreateFlowState;
  updateState: (updates: Partial<CreateFlowState>) => void;
  onBack: () => void;
}

// Map workflow steps to kid-friendly messages
const STEP_MESSAGES: Record<string, { emoji: string; message: string }> = {
  init: { emoji: '📖', message: 'Once upon a time...' },
  waiting_for_character_spec: { emoji: '⭐', message: 'Getting ready for your hero...' },
  character_options_generating: { emoji: '✨', message: 'Your hero springs to life!' },
  character_options_ready: { emoji: '🎨', message: 'Character options are ready!' },
  character_selected: { emoji: '👤', message: 'Perfect! Your hero is chosen!' },
  style_profile: { emoji: '🎨', message: 'Choosing the perfect colors...' },
  style_profile_complete: { emoji: '🌈', message: 'Colors are mixed and ready!' },
  pages_json_generating: { emoji: '📖', message: 'Weaving your story together...' },
  pages_json_complete: { emoji: '📚', message: 'Story outline is complete!' },
  layout_agent_deciding: { emoji: '📐', message: 'Designing the perfect layout...' },
  layout_complete: { emoji: '✓', message: 'Layout is ready!' },
  manifest_writing: { emoji: '📚', message: 'Binding your book together...' },
  done: { emoji: '🌟', message: 'Your story is ready!' },
  cancelled: { emoji: '⏸️', message: 'Workflow cancelled' },
  workflow_failed: { emoji: '❌', message: 'Something went wrong' },
};

const getStepMessage = (step: string): { emoji: string; message: string } => {
  // Check for page-specific steps
  if (step.startsWith('page_')) {
    const match = step.match(/page_(\d+)_illustration/);
    if (match) {
      return { emoji: '🖼️', message: `Drawing page ${match[1]}...` };
    }
    if (step.includes('render')) {
      const match = step.match(/page_(\d+)_render/);
      if (match) {
        return { emoji: '✨', message: `Adding magical details to page ${match[1]}...` };
      }
    }
    if (step.includes('complete')) {
      const match = step.match(/page_(\d+)_complete/);
      if (match) {
        return { emoji: '✓', message: `Page ${match[1]} is complete!` };
      }
    }
  }

  return STEP_MESSAGES[step] || { emoji: '✨', message: step.replace(/_/g, ' ') };
};

export default function Step5Magic({ state, onBack }: Step5MagicProps) {
  const router = useRouter();
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const workflowId = state.workflowId;
  const sseUrl = workflowId ? `/api/workflows/progress/${workflowId}` : null;

  const handleMessage = useCallback(
    (data: WorkflowState) => {
      setWorkflowState(data);
      setIsConnected(true);

      // Auto-redirect on completion
      if (data.status === 'completed' && state.bookId) {
        setTimeout(() => {
          router.push(`/book/${state.bookId}`);
        }, 3000);
      }
    },
    [state.bookId, router]
  );

  const handleError = useCallback(() => {
    setIsConnected(false);
  }, []);

  useSSE<WorkflowState>(sseUrl, handleMessage, handleError);

  const handleCancel = async () => {
    if (!workflowId) return;
    const confirmed = confirm('Are you sure you want to start over? Your hero will disappear! 😢');
    if (!confirmed) return;

    try {
      await fetch('/api/workflows/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: state.bookId, type: 'cancel' }),
      });
    } catch (error) {
      console.error('Error cancelling workflow:', error);
    }
  };

  const handlePause = async () => {
    if (!state.bookId) return;
    try {
      await fetch('/api/workflows/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: state.bookId, type: 'pause' }),
      });
    } catch (e) {
      console.error('Pause failed', e);
    }
  };

  const handleResume = async () => {
    if (!state.bookId) return;
    try {
      await fetch('/api/workflows/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: state.bookId, type: 'resume' }),
      });
    } catch (e) {
      console.error('Resume failed', e);
    }
  };

  const percentage = workflowState?.total && workflowState.completed
    ? Math.round((workflowState.completed / workflowState.total) * 100)
    : 0;

  const currentStep = workflowState?.updates && workflowState.updates.length > 0
    ? workflowState.updates[workflowState.updates.length - 1]
    : null;

  const stepInfo = currentStep ? getStepMessage(currentStep.step) : { emoji: '✨', message: 'Starting...' };

  const toDataUrl = (filePath: string) => {
    if (!filePath) return '';
    const norm = filePath.replace(/\\/g, '/');
    const m = norm.match(/(?:^\.?\/)?data\/books\/(.*)$/);
    const rel = m ? m[1] : norm;
    return `/data/${rel}`;
  };

  // Show concurrency-aware message when multiple pages are drawing at once
  const activePageIndices = (workflowState?.pages || [])
    .filter(p => p.status === 'generating' || p.status === 'rendering')
    .map(p => p.pageIndex)
    .sort((a, b) => a - b);
  const displayMessage = activePageIndices.length >= 2
    ? `Drawing pages ${activePageIndices[0]} and ${activePageIndices[1]} simultaneously...`
    : stepInfo.message;

  return (
    <div className='max-w-5xl mx-auto'>
      <motion.div
        className='text-center mb-12'
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className='text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'>
          Watch the Magic Happen! ✨
        </h1>
        <p className='text-xl text-gray-600'>
          Your book is being created right now...
        </p>
      </motion.div>

      {/* Main Progress Card */}
      <Card className='mb-8 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200'>
        <div className='text-center'>
          {/* Animated Emoji */}
          <AnimatePresence mode='wait'>
            <motion.div
              key={displayMessage}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ duration: 0.5 }}
              className='text-9xl mb-6'
            >
              {stepInfo.emoji}
            </motion.div>
          </AnimatePresence>

          {/* Current Message */}
          <AnimatePresence mode='wait'>
            <motion.h2
              key={displayMessage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className='text-3xl font-bold text-gray-900 mb-6'
            >
              {displayMessage}
            </motion.h2>
          </AnimatePresence>

          {/* Progress Bar */}
          <div className='max-w-2xl mx-auto mb-6'>
            <div className='h-6 bg-white rounded-full overflow-hidden shadow-inner'>
              <motion.div
                className='h-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold'
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5 }}
              >
                {percentage > 10 && `${percentage}%`}
              </motion.div>
            </div>
            <div className='flex justify-between text-sm text-gray-600 mt-2'>
              <span>{workflowState?.completed || 0} tasks done</span>
              <span>{workflowState?.total || 0} total tasks</span>
            </div>
          </div>

          {/* Status Badge */}
          <div className='flex items-center justify-center gap-3 mb-6'>
            {workflowState?.status === 'running' && (
              <div className='flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full'>
                <Spinner size='sm' />
                <span className='font-semibold'>Creating...</span>
              </div>
            )}
            {workflowState?.status === 'completed' && (
              <div className='px-4 py-2 bg-green-100 text-green-700 rounded-full font-semibold'>
                ✓ Complete!
              </div>
            )}
            {workflowState?.status === 'failed' && (
              <div className='px-4 py-2 bg-red-100 text-red-700 rounded-full font-semibold'>
                ✕ Failed
              </div>
            )}
            {workflowState?.status === 'cancelled' && (
              <div className='px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full font-semibold'>
                ⏸ Cancelled
              </div>
            )}
          </div>

          {/* Completion Message */}
          {workflowState?.status === 'completed' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 }}
              className='mb-6'
            >
              <div className='text-6xl mb-4'>🎉</div>
              <h3 className='text-2xl font-bold text-gray-900 mb-2'>
                Your Book is Ready!
              </h3>
              <p className='text-gray-600'>
                Taking you to your book now...
              </p>
            </motion.div>
          )}

          {/* Actions */}
          <div className='flex gap-3 justify-center'>
            {workflowState?.status === 'running' && (
              <>
                <Button variant='secondary' onClick={handlePause}>
                  Pause
                </Button>
                <Button variant='primary' onClick={handleResume}>
                  Resume
                </Button>
                <Button variant='danger' onClick={handleCancel}>
                  Cancel & Start Over
                </Button>
              </>
            )}
            {workflowState?.status === 'completed' && state.bookId && (
              <Button size='lg' onClick={() => router.push(`/book/${state.bookId}`)}>
                View My Book! 📖
              </Button>
            )}
            {workflowState?.status === 'failed' && (
              <Button variant='secondary' onClick={() => window.location.href = '/create'}>
                Try Again
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Activity Log */}
      {workflowState && workflowState.updates.length > 0 && (
        <Card>
          <h3 className='font-bold text-lg text-gray-900 mb-4'>✨ Magic in Progress</h3>
          <div className='space-y-2 max-h-64 overflow-y-auto'>
            {workflowState.updates.map((update, index) => {
              const info = getStepMessage(update.step);
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className='flex items-center gap-3 p-3 bg-purple-50 rounded-lg'
                >
                  <div className='text-2xl'>{info.emoji}</div>
                  <div className='flex-1'>
                    <div className='font-medium text-sm'>{info.message}</div>
                    {update.message && (
                      <div className='text-xs text-gray-600'>{update.message}</div>
                    )}
                  </div>
                  <div className='text-xs text-gray-500'>{update.percent.toFixed(0)}%</div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Per-page streaming previews */}
      {workflowState?.pages && workflowState.pages.length > 0 && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mt-8'>
          {workflowState.pages.map((p: PageArtifactState) => {
            const derivedPreview = p.illustrationPath ? p.illustrationPath.replace(/illustration\.png$/i, 'preview.jpg') : undefined;
            const imgSrc = p.renderPaths?.screen
              ? toDataUrl(p.renderPaths.screen)
              : p.previewPath
              ? toDataUrl(p.previewPath)
              : derivedPreview
              ? toDataUrl(derivedPreview)
              : p.illustrationPath
              ? toDataUrl(p.illustrationPath)
              : null;
            return (
              <Card key={p.pageIndex} className='p-4'>
                <div className='text-sm text-gray-600 mb-2'>Page {p.pageIndex}</div>
                <div className='w-full aspect-[16/9] bg-gray-100 rounded overflow-hidden flex items-center justify-center'>
                  {imgSrc ? (
                    // Use native img for progressive JPEG; Next Image can buffer
                    <img
                      src={imgSrc}
                      alt={`Page ${p.pageIndex}`}
                      className='w-full h-full object-cover transition-opacity duration-500'
                      loading='eager'
                    />
                  ) : (
                    <div className='w-full h-full animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200' />
                  )}
                </div>
                <div className='mt-2 text-xs text-gray-700'>
                  {p.message || (p.status === 'generating' ? 'Drawing...' : p.status)}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

