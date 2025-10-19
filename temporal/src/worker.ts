// @@@SNIPSTART typescript-next-oneclick-worker
import { config } from 'dotenv';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { TASK_QUEUE_NAME } from './shared';

// Load .env.local for worker process
config({ path: '.env.local' });

run().catch(err => console.log(err));

async function run() {
  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
    // In production, pass options to configure TLS and other settings.
  });
  try {
    const worker = await Worker.create({
      connection,
      workflowsPath: require.resolve('./workflows'),
      activities,
      taskQueue: TASK_QUEUE_NAME,
    });
    console.log('Worker started. Environment loaded:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      booksDir: process.env.BOOKS_DATA_DIR,
    });
    await worker.run();
  } finally {
    connection.close();
  }
}
// @@@SNIPEND
