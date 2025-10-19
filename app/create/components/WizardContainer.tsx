'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateFlowState } from '../types';
import StepProgress from './StepProgress';

interface WizardContainerProps {
  children: (
    state: CreateFlowState, 
    updateState: (updates: Partial<CreateFlowState>) => void, 
    navigation: NavigationControls,
    coverGenerationEnabled: boolean | null
  ) => React.ReactNode;
}

interface NavigationControls {
  canGoNext: boolean;
  canGoBack: boolean;
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: number, subStep?: number) => void;
  goToSubStep: (subStep: number) => void;
}

export default function WizardContainer({ children }: WizardContainerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [coverGenerationEnabled, setCoverGenerationEnabled] = useState<boolean | null>(null);
  const [state, setState] = useState<CreateFlowState>(() => ({
    currentStep: 1,
    currentSubStep: 1, // For multi-part Step 1 (1=Hub, 2=Props, 3=Sets)
    // Don't generate bookId here; let workflow provide it
    story: {
      title: '',
      topics: [],
      pages: 6,
      tone: 'cheerful',
      targetAge: 6,
      dyslexiaMode: false,
      fontScale: 1,
      highContrast: false,
    },
    characterMaturity: 'unspecified',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  // Fetch configuration on mount
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(config => setCoverGenerationEnabled(config.coverGenerationEnabled))
      .catch(err => console.error('Failed to fetch config:', err));
  }, []);

  // Initialize from URL query params on first render
  useEffect(() => {
    if (!searchParams) return;
    const stepStr = searchParams.get('step');
    const workflowId = searchParams.get('workflowId') || undefined;
    const bookId = searchParams.get('bookId') || undefined;
    const parsedStep = stepStr ? parseInt(stepStr, 10) : undefined;

    if (workflowId || bookId || parsedStep) {
      setState((prev) => ({
        ...prev,
        currentStep:
          parsedStep && parsedStep >= 1 && parsedStep <= 6
            ? parsedStep
            : workflowId
            ? Math.max(prev.currentStep, 3)
            : prev.currentStep,
        workflowId: workflowId ?? prev.workflowId,
        bookId: bookId ?? prev.bookId,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL in sync with wizard state (step, workflowId, bookId)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('step', String(state.currentStep));
    if (state.workflowId) params.set('workflowId', state.workflowId);
    if (state.bookId) params.set('bookId', state.bookId);
    const url = `${pathname}?${params.toString()}`;
    router.replace(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentStep, state.workflowId, state.bookId]);

  const updateState = (updates: Partial<CreateFlowState>) => {
    setState((prev) => ({
      ...prev,
      ...updates,
      updatedAt: Date.now(),
    }));
  };

  const navigation: NavigationControls = {
    canGoNext: state.currentStep < 6,
    canGoBack: state.currentStep > 1 || (state.currentStep === 1 && (state.currentSubStep || 1) > 1),
    goNext: () => {
      // Step 1 has 3 sub-steps
      if (state.currentStep === 1) {
        const subStep = state.currentSubStep || 1;
        if (subStep < 3) {
          updateState({ currentSubStep: subStep + 1 });
        } else {
          // Move to Step 2
          updateState({ currentStep: 2, currentSubStep: undefined });
        }
      } else if (state.currentStep === 4) {
        // Check if covers are disabled via config or workflow progress
        const progressStep = (state.progress as any)?.step;
        const progressUpdates = (state.progress as any)?.progressUpdates || [];
        const coversSkippedInProgress = progressStep === 'covers_skipped' || 
          progressUpdates.some((u: any) => u.step === 'covers_skipped');
        const shouldSkipCovers = coverGenerationEnabled === false || coversSkippedInProgress;
        
        if (shouldSkipCovers) {
          // Skip Step 5, go directly to Step 6
          updateState({ currentStep: 6, currentSubStep: undefined });
        } else {
          updateState({ currentStep: state.currentStep + 1, currentSubStep: undefined });
        }
      } else if (state.currentStep < 6) {
        updateState({ currentStep: state.currentStep + 1, currentSubStep: undefined });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    goBack: () => {
      // Handle sub-steps in Step 1
      if (state.currentStep === 1 && (state.currentSubStep || 1) > 1) {
        updateState({ currentSubStep: (state.currentSubStep || 1) - 1 });
      } else if (state.currentStep === 2) {
        // Going back from Step 2 to Step 1.3
        updateState({ currentStep: 1, currentSubStep: 3 });
      } else if (state.currentStep === 6) {
        // Check if covers were skipped via config or workflow progress
        const progressStep = (state.progress as any)?.step;
        const progressUpdates = (state.progress as any)?.progressUpdates || [];
        const coversSkippedInProgress = progressStep === 'covers_skipped' || 
          progressUpdates.some((u: any) => u.step === 'covers_skipped');
        const shouldSkipCovers = coverGenerationEnabled === false || coversSkippedInProgress;
        
        if (shouldSkipCovers) {
          // Skip Step 5, go back to Step 4
          updateState({ currentStep: 4, currentSubStep: undefined });
        } else {
          updateState({ currentStep: state.currentStep - 1, currentSubStep: undefined });
        }
      } else if (state.currentStep > 1) {
        updateState({ currentStep: state.currentStep - 1, currentSubStep: undefined });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    goToStep: (step: number, subStep?: number) => {
      if (step >= 1 && step <= 6) {
        updateState({ currentStep: step, currentSubStep: step === 1 ? (subStep || 1) : undefined });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    goToSubStep: (subStep: number) => {
      if (state.currentStep === 1 && subStep >= 1 && subStep <= 3) {
        updateState({ currentSubStep: subStep });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50'>
      <div className='mx-auto max-w-7xl px-4 py-8'>
        <div className='flex gap-8'>
          {/* Left Sidebar - Progress */}
          <div className='hidden lg:block w-64 flex-shrink-0'>
            <div className='sticky top-8'>
              <StepProgress
                currentStep={state.currentStep}
                currentSubStep={state.currentSubStep}
                onStepClick={navigation.goToStep}
                percent={typeof state.progress?.total === 'number' && typeof state.progress?.completed === 'number'
                  ? Math.round((state.progress.completed / Math.max(1, state.progress.total)) * 100)
                  : undefined}
                coverGenerationEnabled={coverGenerationEnabled ?? true}
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div className='flex-1 min-w-0'>
            <AnimatePresence mode='wait'>
              <motion.div
                key={`${state.currentStep}-${state.currentSubStep || 0}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {children(state, updateState, navigation, coverGenerationEnabled)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

