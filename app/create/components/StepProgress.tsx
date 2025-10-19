'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Step {
  number: number;
  title: string;
  emoji: string;
  description: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Build Your Cast',
    emoji: '🎭',
    description: 'Create your characters',
  },
  {
    number: 2,
    title: 'Pick Art Style',
    emoji: '🎨',
    description: 'Choose how your story looks',
  },
  {
    number: 3,
    title: 'Meet Your Hero',
    emoji: '✨',
    description: 'Select your favorite design',
  },
  {
    number: 4,
    title: 'Shape Your Story',
    emoji: '📖',
    description: 'Add story details',
  },
  {
    number: 5,
    title: 'Pick Your Cover',
    emoji: '📚',
    description: 'Choose the perfect cover',
  },
  {
    number: 6,
    title: 'Watch the Magic',
    emoji: '🎉',
    description: 'Your book comes alive',
  },
];

const STEP_1_SUBSTEPS = [
  { sub: 1, name: 'Pick Characters', emoji: '⭐' },
  { sub: 2, name: 'Add Props', emoji: '🎨' },
  { sub: 3, name: 'Choose Style', emoji: '✨' },
];

interface StepProgressProps {
  currentStep: number;
  currentSubStep?: number;
  onStepClick: (step: number) => void;
  percent?: number;
  coverGenerationEnabled?: boolean;
}

export default function StepProgress({ currentStep, currentSubStep, onStepClick, percent, coverGenerationEnabled = true }: StepProgressProps) {
  const subStepText = currentStep === 1 && currentSubStep ? ` (${currentSubStep}/3)` : '';
  const totalSteps = coverGenerationEnabled ? 6 : 5;
  const displayStep = coverGenerationEnabled || currentStep <= 5 ? currentStep : currentStep - 1;
  
  return (
    <div className='bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-100'>
      <div className='mb-6'>
        <h2 className='text-lg font-bold text-gray-900 mb-1'>Your Story Journey</h2>
        <p className='text-sm text-gray-600'>Step {displayStep} of {totalSteps}{subStepText}</p>
        {typeof percent === 'number' && percent >= 0 && (
          <div className='mt-3'>
            <div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
              <motion.div
                className='h-full bg-gradient-to-r from-purple-500 to-pink-500'
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <div className='text-right text-xs text-gray-500 mt-1'>{Math.round(percent)}%</div>
          </div>
        )}
      </div>

      <div className='space-y-4'>
        {STEPS.map((step) => {
          // Skip step 5 if cover generation is disabled
          if (step.number === 5 && !coverGenerationEnabled) {
            return null;
          }
          
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const isAccessible = step.number <= currentStep;

          return (
            <div key={step.number}>
              <motion.button
                onClick={() => isAccessible && onStepClick(step.number)}
                disabled={!isAccessible}
                className={`
                  w-full text-left p-4 rounded-xl transition-all duration-200
                  ${isActive ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105' : ''}
                  ${isCompleted ? 'bg-purple-50 hover:bg-purple-100 cursor-pointer' : ''}
                  ${!isActive && !isCompleted ? 'bg-gray-50 opacity-50 cursor-not-allowed' : ''}
                  ${isAccessible && !isActive ? 'hover:scale-102' : ''}
                `}
                whileHover={isAccessible && !isActive ? { scale: 1.02 } : {}}
                whileTap={isAccessible && !isActive ? { scale: 0.98 } : {}}
              >
                <div className='flex items-start gap-3'>
                  <div
                    className={`
                    flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg
                    ${isActive ? 'bg-white/20' : ''}
                    ${isCompleted ? 'bg-purple-200' : ''}
                    ${!isActive && !isCompleted ? 'bg-gray-200' : ''}
                  `}
                  >
                    {isCompleted ? '✓' : step.emoji}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className={`font-semibold mb-1 ${isActive ? 'text-white' : 'text-gray-900'}`}>
                      {step.title}
                    </div>
                    <div className={`text-xs ${isActive ? 'text-white/90' : 'text-gray-600'}`}>
                      {step.description}
                    </div>
                  </div>
                </div>
              </motion.button>
              
              {/* Sub-steps for Step 1 */}
              {step.number === 1 && isActive && currentSubStep && (
                <div className='mt-2 ml-11 space-y-1'>
                  {STEP_1_SUBSTEPS.map(sub => {
                    const isSubActive = sub.sub === currentSubStep;
                    const isSubCompleted = sub.sub < currentSubStep;
                    
                    return (
                      <div
                        key={sub.sub}
                        className={`
                          text-xs px-3 py-1.5 rounded-lg flex items-center gap-2
                          ${isSubActive ? 'bg-white/20 text-white font-semibold' : ''}
                          ${isSubCompleted ? 'text-white/70' : ''}
                          ${!isSubActive && !isSubCompleted ? 'text-white/50' : ''}
                        `}
                      >
                        <span className='text-sm'>{isSubCompleted ? '✓' : sub.emoji}</span>
                        <span>{sub.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Decorative character avatar */}
      <div className='mt-8 text-center'>
        <motion.div
          className='text-6xl'
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {currentStep === 1 && '🌟'}
          {currentStep === 2 && '🎨'}
          {currentStep === 3 && '✨'}
          {currentStep === 4 && '📚'}
          {currentStep === 5 && '📖'}
          {currentStep === 6 && '🎉'}
        </motion.div>
        <p className='mt-2 text-sm text-gray-600 font-medium'>Creating magic...</p>
      </div>
    </div>
  );
}

