import { getTemporalClient } from '../../../../lib/temporalClient';

export async function getHandle(bookId: string) {
  const workflowId = `book-${bookId}`;
  return getTemporalClient().workflow.getHandle(workflowId);
}
