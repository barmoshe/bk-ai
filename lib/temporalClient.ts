import { Client, Connection, WorkflowHandle } from '@temporalio/client';
import { WorkflowState } from '../temporal/src/types';

let client: Client | undefined;

export function getTemporalClient(): Client {
  if (!client) {
    const connection = Connection.lazy({ address: 'localhost:7233' });
    client = new Client({ connection });
  }
  return client;
}

export async function getWorkflowHandle(workflowId: string): Promise<WorkflowHandle> {
  return getTemporalClient().workflow.getHandle(workflowId);
}

export async function queryWorkflowState(workflowId: string): Promise<WorkflowState> {
  const handle = await getWorkflowHandle(workflowId);
  try {
    const state = await handle.query<WorkflowState>('getWorkflowState');
    return state;
  } catch (error) {
    // If workflow not found or query fails, return a failed state
    return {
      workflowId,
      startedAt: new Date().toISOString(),
      updates: [],
      status: 'failed',
      error: String(error),
    };
  }
}

export async function cancelWorkflow(workflowId: string): Promise<void> {
  const handle = await getWorkflowHandle(workflowId);
  await handle.signal('cancelSignal');
}

