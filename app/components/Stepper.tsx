'use client';
import React from 'react';
import { Badge } from './ui/Badge';

type StepStatus = 'pending' | 'active' | 'completed' | 'error';

interface Step {
  label: string;
  status: StepStatus;
  onClick?: () => void;
}

interface StepperProps {
  steps: Step[];
  className?: string;
}

const statusStyles: Record<StepStatus, string> = {
  pending: 'bg-gray-100 text-gray-500',
  active: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white animate-pulse-soft',
  completed: 'bg-positive text-white',
  error: 'bg-error text-white',
};

const statusIcons: Record<StepStatus, string> = {
  pending: '○',
  active: '◉',
  completed: '✓',
  error: '✕',
};

export function Stepper({ steps, className = '' }: StepperProps) {
  return (
    <ol className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
      {steps.map((step, index) => {
        const clickable = step.onClick ? 'cursor-pointer hover:scale-105' : '';
        return (
          <li key={`${step.label}-${index}`}>
            <button
              onClick={step.onClick}
              disabled={!step.onClick}
              className={`${statusStyles[step.status]} ${clickable} rounded-full px-4 py-2 font-medium transition-all duration-200 flex items-center gap-2 disabled:cursor-default`}
              aria-current={step.status === 'active' ? 'step' : undefined}
            >
              <span aria-hidden="true">{statusIcons[step.status]}</span>
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// Legacy simple stepper for backwards compatibility
// (Removed) SimpleStepper legacy export










