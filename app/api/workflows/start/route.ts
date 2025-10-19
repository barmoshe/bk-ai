import { getTemporalClient } from '../../../../lib/temporalClient';
import { BookOrchestratorWorkflow } from '../../../../temporal/src/workflows';
import { TASK_QUEUE_NAME } from '../../../../temporal/src/shared';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const bookId = body.bookId && typeof body.bookId === 'string' ? body.bookId : randomUUID();
  const workflowId = `book-${bookId}`;

  try {
    await getTemporalClient().workflow.start(BookOrchestratorWorkflow as any, {
      taskQueue: TASK_QUEUE_NAME,
      workflowId,
      args: [bookId],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    // If already started, treat as success and return existing ids (idempotent start)
    if (!/already started|Workflow execution already started/i.test(msg)) throw e;
  }

  return Response.json({ ok: true, bookId, workflowId });
}






