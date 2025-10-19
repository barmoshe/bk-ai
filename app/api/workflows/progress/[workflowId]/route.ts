import { queryWorkflowState } from '../../../../../lib/temporalClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { workflowId: string } }
) {
  const { workflowId } = params;

  if (!workflowId) {
    return new Response('Missing workflowId', { status: 400 });
  }

  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let lastState = '';

      const sendUpdate = async () => {
        try {
          const state = await queryWorkflowState(workflowId);
          const stateJson = JSON.stringify(state);

          // Only send if state changed
          if (stateJson !== lastState) {
            try {
              controller.enqueue(encoder.encode(`data: ${stateJson}\n\n`));
            } catch {
              // controller already closed; stop interval
              if (intervalId) clearInterval(intervalId);
              return;
            }
            lastState = stateJson;

            // Close stream if workflow is done
            if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
              if (intervalId) {
                clearInterval(intervalId);
              }
              controller.close();
            }
          }
        } catch (error) {
          console.error('Error querying workflow state:', error);
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  workflowId,
                  startedAt: new Date().toISOString(),
                  updates: [],
                  status: 'failed',
                  error: String(error),
                })}\n\n`
              )
            );
          } finally {
            if (intervalId) clearInterval(intervalId);
            try { controller.close(); } catch {}
          }
        }
      };

      // Send initial state
      await sendUpdate();

      // Poll every second
      intervalId = setInterval(sendUpdate, 1000);

      // Clean up on abort
      req.signal?.addEventListener('abort', () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

