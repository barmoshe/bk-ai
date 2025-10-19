'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Input } from '../components/ui/Input';
import { useSSE } from '../lib/useSSE';
import { WorkflowState } from '../../temporal/src/types';
import { Stepper } from '../components/Stepper';
import { useToast } from '../components/ui/Toast';

export default function ProgressPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workflowId, setWorkflowId] = useState<string>(
    searchParams?.get('workflowId') || ''
  );
  const [inputWorkflowId, setInputWorkflowId] = useState('');
  const [state, setState] = useState<WorkflowState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { showToast } = useToast();

  const sseUrl = workflowId ? `/api/workflows/progress/${workflowId}` : null;

  const handleMessage = useCallback(
    (data: WorkflowState) => {
      setState(data);
      setIsConnected(true);

      // Minimal retry toast when activities schedule a retry (via heartbeats)
      try {
        const last = data?.updates?.[data.updates.length - 1];
        if (last?.step?.includes('retry_scheduled') && last?.message) {
          showToast(last.message, 'warning');
        }
      } catch {}

      // Auto-redirect on completion
      if (data.status === 'completed' && data.workflowId) {
        const bookId = data.workflowId.replace('book-', '');
        setTimeout(() => {
          router.push(`/book/${bookId}`);
        }, 2000);
      }
    },
    [router, showToast]
  );

  const handleError = useCallback(() => {
    setIsConnected(false);
  }, []);

  useSSE<WorkflowState>(sseUrl, handleMessage, handleError);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputWorkflowId.trim()) {
      setWorkflowId(inputWorkflowId.trim());
      router.push(`/progress?workflowId=${inputWorkflowId.trim()}`);
    }
  };

  const handleCancel = async () => {
    if (!workflowId) return;
    const confirmed = confirm('Are you sure you want to cancel this workflow?');
    if (!confirmed) return;

    try {
      await fetch('/api/workflows/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId }),
      });
    } catch (error) {
      console.error('Error cancelling workflow:', error);
    }
  };

  if (!workflowId) {
    return (
      <div className='mx-auto max-w-2xl'>
        <Card>
          <h1 className='text-3xl font-bold text-gray-900 mb-4'>📊 Workflow Progress</h1>
          <p className='text-gray-600 mb-6'>
            Enter a workflow ID to track the progress of a book creation workflow.
          </p>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <Input
              label='Workflow ID'
              placeholder='e.g., book-abc123...'
              value={inputWorkflowId}
              onChange={(e) => setInputWorkflowId(e.target.value)}
              helpText='You can find this in the URL when creating a book'
            />
            <Button type='submit' className='w-full'>
              Track Progress
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const percentage = state?.total && state.completed
    ? Math.round((state.completed / state.total) * 100)
    : 0;

  const statusBadge = state ? (
    state.status === 'running' ? (
      <Badge variant='primary'>🔄 Running</Badge>
    ) : state.status === 'completed' ? (
      <Badge variant='success'>✓ Completed</Badge>
    ) : state.status === 'failed' ? (
      <Badge variant='error'>✕ Failed</Badge>
    ) : (
      <Badge variant='warning'>⏸ Cancelled</Badge>
    )
  ) : null;

  // Map updates to stepper steps
  const steps: Array<{ label: string; status: 'pending' | 'active' | 'completed' | 'error' }> = state?.updates && state.updates.length > 0
    ? state.updates.slice(0, -1).map((update) => ({
        label: update.step.replace(/_/g, ' '),
        status: 'completed' as const,
      }))
    : [];

  if (state && state.status === 'running' && state.updates.length > 0) {
    const lastUpdate = state.updates[state.updates.length - 1];
    steps.push({
      label: lastUpdate.step.replace(/_/g, ' '),
      status: 'active' as const,
    });
  } else if (state && state.status === 'completed' && state.updates.length > 0) {
    const lastUpdate = state.updates[state.updates.length - 1];
    steps.push({
      label: lastUpdate.step.replace(/_/g, ' '),
      status: 'completed' as const,
    });
  } else if (state && state.status === 'failed' && state.updates.length > 0) {
    const lastUpdate = state.updates[state.updates.length - 1];
    steps.push({
      label: lastUpdate.step.replace(/_/g, ' '),
      status: 'error' as const,
    });
  }

  return (
    <div className='mx-auto max-w-4xl'>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>
            📊 Workflow Progress
          </h1>
          <p className='text-sm text-gray-600 font-mono'>{workflowId}</p>
        </div>
        <div className='flex gap-2'>
          {statusBadge}
          {isConnected ? (
            <Badge variant='success'>🟢 Live</Badge>
          ) : (
            <Badge variant='neutral'>⚪ Disconnected</Badge>
          )}
        </div>
      </div>

      {!state ? (
        <Card className='text-center py-12'>
          <Spinner size='lg' className='mx-auto mb-4' />
          <p className='text-gray-600'>Connecting to workflow...</p>
        </Card>
      ) : (
        <>
          <Card className='mb-6'>
            <div className='mb-6'>
              {state.status === 'running' && (
                <div className='flex items-center justify-center mb-6'>
                  <div className='relative'>
                    <Spinner size='lg' />
                    <div className='absolute inset-0 flex items-center justify-center text-xs font-bold text-primary-600'>
                      {percentage}%
                    </div>
                  </div>
                </div>
              )}
              
              {state.status === 'completed' && (
                <div className='text-center mb-6'>
                  <div className='text-6xl mb-3'>✨</div>
                  <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                    Book Created Successfully!
                  </h2>
                  <p className='text-gray-600 mb-4'>
                    Redirecting you to view your book...
                  </p>
                </div>
              )}

              {state.status === 'failed' && (
                <div className='text-center mb-6'>
                  <div className='text-6xl mb-3'>❌</div>
                  <h2 className='text-2xl font-bold text-error mb-2'>
                    Workflow Failed
                  </h2>
                  {state.error && (
                    <p className='text-sm text-gray-700 bg-error-light p-3 rounded-lg'>
                      {state.error}
                    </p>
                  )}
                </div>
              )}

              {state.status === 'cancelled' && (
                <div className='text-center mb-6'>
                  <div className='text-6xl mb-3'>⏸️</div>
                  <h2 className='text-2xl font-bold text-warn mb-2'>
                    Workflow Cancelled
                  </h2>
                </div>
              )}

              <div className='mb-6'>
                <div className='h-3 w-full overflow-hidden rounded-full bg-gray-200'>
                  <div
                    className='h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500 ease-out'
                    style={{ width: `${percentage}%` }}
                    role='progressbar'
                    aria-valuenow={percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <div className='mt-2 flex justify-between text-sm text-gray-600'>
                  <span>
                    {state.completed ?? 0} / {state.total ?? 0} tasks
                  </span>
                  <span>{percentage}%</span>
                </div>
              </div>

              {state.status === 'running' && (
                <Button
                  variant='danger'
                  size='sm'
                  onClick={handleCancel}
                  className='w-full'
                >
                  Cancel Workflow
                </Button>
              )}
            </div>
          </Card>

          {steps.length > 0 && (
            <Card className='mb-6'>
              <h3 className='font-bold text-lg text-gray-900 mb-4'>Progress Steps</h3>
              <Stepper steps={steps} className='mb-4' />
            </Card>
          )}

          <Card>
            <h3 className='font-bold text-lg text-gray-900 mb-4'>Activity Log</h3>
            <div className='space-y-2 max-h-96 overflow-y-auto'>
              {state.updates.length === 0 ? (
                <p className='text-sm text-gray-500 text-center py-4'>
                  No activity yet...
                </p>
              ) : (
                state.updates.map((update, index) => (
                  <div
                    key={index}
                    className='flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors'
                  >
                    <div className='flex-shrink-0 mt-1'>
                      <div className='h-2 w-2 rounded-full bg-primary-600' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <span className='font-medium text-gray-900 text-sm'>
                          {update.step.replace(/_/g, ' ')}
                        </span>
                        <Badge variant='neutral'>{update.percent.toFixed(0)}%</Badge>
                        {update.step.includes('retry_scheduled') && (
                          <Badge variant='warning'>Retrying soon</Badge>
                        )}
                      </div>
                      {update.message && (
                        <p className='text-xs text-gray-600 mt-1'>{update.message}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
