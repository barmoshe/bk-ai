'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateFlowState } from './types';
import WizardContainer from './components/WizardContainer';
import SimpleCharacterForm from './components/SimpleCharacterForm';
import Step4Story from './components/Step4Story';
import Step5Covers from './components/Step5Covers';
import Step5Magic from './components/Step5Magic';

export default function CreatePage() {
  return (
    <WizardContainer>
      {(state, updateState, navigation, coverGenerationEnabled) => {
        // New default: Simple, single-character quick create at top
        if (state.currentStep === 1) {
          return (
            <SimpleCharacterForm
              onChosen={(ch) => {
                // Save workflow IDs and proceed to story config
                updateState({
                  bookId: ch.bookId,
                  workflowId: ch.workflowId,
                  currentStep: 4, // Skip to story config
                  updatedAt: Date.now(),
                });
              }}
            />
          );
        }


        // Step 4: Story Configuration
        if (state.currentStep === 4) {
          return (
            <Step4Story
              state={state}
              updateState={updateState}
              onNext={navigation.goNext}
              onBack={navigation.goBack}
            />
          );
        }

        // Step 5: Cover Selection (skip if covers disabled)
        if (state.currentStep === 5) {
          // Check if covers are disabled via config or workflow progress
          const progressStep = (state.progress as any)?.step;
          const progressUpdates = (state.progress as any)?.progressUpdates || [];
          const coversSkippedInProgress = progressStep === 'covers_skipped' || 
            progressUpdates.some((u: any) => u.step === 'covers_skipped');
          const shouldSkipCovers = coverGenerationEnabled === false || coversSkippedInProgress;
          
          if (shouldSkipCovers) {
            // Auto-skip to Step 6 if covers are disabled
            navigation.goNext();
            return null;
          }
          
          return (
            <Step5Covers
              state={state}
              updateState={updateState}
              onNext={navigation.goNext}
              onBack={navigation.goBack}
            />
          );
        }

        // Step 6: Magic Progress
        if (state.currentStep === 6) {
          return (
            <Step5Magic
              state={state}
              updateState={updateState}
              onBack={navigation.goBack}
            />
          );
        }

        return null;
      }}
    </WizardContainer>
  );
}

