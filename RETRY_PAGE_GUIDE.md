# Retry Failed Pages - Quick Reference

## Problem Solved
Previously, if a single page failed during image generation, the entire book creation workflow would fail. Now, individual pages can fail gracefully and be retried independently.

## How to Use

### 1. Check for Failed Pages

```typescript
import { getTemporalClient } from './lib/temporalClient';

const client = getTemporalClient();
const workflowId = 'book-a6a73a8b-2d4d-49f6-b808-f6b8afa7a5d3';
const handle = client.workflow.getHandle(workflowId);

// Query the workflow state
const state = await handle.query('getState');

// Get list of failed pages
const failedPageIndices = Array.from(state.failedPages);
console.log('Failed pages:', failedPageIndices); // e.g., [1, 3, 5]

// Get error messages
const errorMessages = state.errors;
console.log('Errors:', errorMessages);
```

### 2. Retry a Specific Page

```typescript
// Retry page 3
await handle.executeUpdate('retryPage', { args: [3] });

// The workflow will:
// 1. Find page 3 in state.pages
// 2. Re-generate the illustration (with fresh OpenAI call)
// 3. Re-render the print JPEG
// 4. Remove page 3 from failedPages set on success
// 5. Add to failedPages if it fails again
```

### 3. Retry All Failed Pages

```typescript
const state = await handle.query('getState');
const failedPages = Array.from(state.failedPages);

for (const pageIndex of failedPages) {
  try {
    await handle.executeUpdate('retryPage', { args: [pageIndex] });
    console.log(`✅ Page ${pageIndex} retry succeeded`);
  } catch (error) {
    console.error(`❌ Page ${pageIndex} retry failed:`, error);
  }
}
```

### 4. Monitor Progress

```typescript
// Subscribe to progress updates
const updates = state.progressUpdates;
const pageUpdates = updates.filter(u => u.step.includes('page_'));

pageUpdates.forEach(update => {
  if (update.step.includes('_error')) {
    console.log(`❌ ${update.message}`);
  } else if (update.step.includes('_retry_success')) {
    console.log(`✅ ${update.message}`);
  } else if (update.step.includes('_complete')) {
    console.log(`✓ ${update.message}`);
  }
});
```

## API Route Example

Create `app/api/workflows/retry-page/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '../../../../lib/temporalClient';

export async function POST(req: NextRequest) {
  try {
    const { bookId, pageIndex } = await req.json();
    
    if (!bookId || pageIndex === undefined) {
      return NextResponse.json(
        { error: 'bookId and pageIndex required' },
        { status: 400 }
      );
    }

    const client = getTemporalClient();
    const workflowId = `book-${bookId}`;
    const handle = client.workflow.getHandle(workflowId);

    await handle.executeUpdate('retryPage', { args: [pageIndex] });

    return NextResponse.json({
      success: true,
      message: `Page ${pageIndex} retry initiated`,
    });
  } catch (error: any) {
    console.error('Retry page error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retry page' },
      { status: 500 }
    );
  }
}
```

## Frontend Component Example

```tsx
'use client';

import { useState } from 'react';

interface FailedPage {
  pageIndex: number;
  error: string;
}

export function RetryFailedPagesButton({ bookId, failedPages }: {
  bookId: string;
  failedPages: FailedPage[];
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async (pageIndex: number) => {
    setRetrying(true);
    try {
      const response = await fetch('/api/workflows/retry-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, pageIndex }),
      });

      if (!response.ok) {
        throw new Error('Retry failed');
      }

      alert(`Page ${pageIndex} is being retried!`);
    } catch (error) {
      alert(`Failed to retry page ${pageIndex}`);
    } finally {
      setRetrying(false);
    }
  };

  if (failedPages.length === 0) {
    return null;
  }

  return (
    <div className="border-red-200 bg-red-50 p-4 rounded">
      <h3 className="font-bold text-red-800 mb-2">
        {failedPages.length} page(s) failed
      </h3>
      <div className="space-y-2">
        {failedPages.map(({ pageIndex, error }) => (
          <div key={pageIndex} className="flex items-center justify-between">
            <span className="text-sm text-red-700">
              Page {pageIndex}: {error}
            </span>
            <button
              onClick={() => handleRetry(pageIndex)}
              disabled={retrying}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Error Handling

### Common Retry Scenarios

**Scenario 1: Temporary API issue**
- First attempt: 500 Internal Server Error
- Retry: ✅ Success

**Scenario 2: Persistent validation error**
- First attempt: ApplicationFailure (non-retryable)
- Retry: ❌ Same error (prompt needs fixing)

**Scenario 3: Rate limit**
- First attempt: 429 Too Many Requests
- Wait 60 seconds
- Retry: ✅ Success

### When NOT to Retry

Don't retry if error contains:
- `ApplicationFailure` with `nonRetryable` (schema/validation issue)
- `OPENAI_API_KEY not set` (configuration issue)
- `Image response missing url/b64_json` repeatedly (API compatibility issue)

Fix the root cause instead.

## Debugging Tips

### Check Artifacts
```bash
# View the request that was sent
cat data/books/{bookId}/prompts/image-page-{N}-request.json

# View the response received
cat data/books/{bookId}/prompts/image-page-{N}-response.json

# View error details
cat data/books/{bookId}/prompts/image-page-{N}-response-error.json
```

### View Temporal UI
1. Open http://localhost:8233 (or your Temporal UI)
2. Search for workflow: `book-{bookId}`
3. Go to "History" tab
4. Look for:
   - `ActivityTaskFailed` events
   - `WorkflowExecutionUpdateAccepted` (retry trigger)
   - Heartbeat payloads

### Check Logs
```bash
# Activity logs
grep "page.*image gen failed" data/books/{bookId}/errors.log

# Progress updates
# Query getWorkflowState and look at updates array
```

## Best Practices

1. **Wait between retries**: Don't hammer the API; wait 30-60s between retries
2. **Set a limit**: Don't retry the same page >5 times without investigation
3. **Batch retries**: If 10+ pages failed, likely a systemic issue (API key, quota)
4. **Monitor patterns**: If same pages fail repeatedly, check prompts/character
5. **Use child workflows**: For high-value books, migrate to PageRenderWorkflow

## FAQ

**Q: Can I retry a page that succeeded?**
A: Yes, but it will regenerate the image (new AI output). Use only if output was unsatisfactory.

**Q: Will retry use the same prompt?**
A: Yes, it uses the exact same page data from `state.pages[pageIndex]`.

**Q: What if the workflow is completed?**
A: Updates can be sent to completed workflows, but they won't execute. Check workflow status first.

**Q: Can I modify the page text before retry?**
A: Not via retry update. You'd need to create a new workflow or implement a `updatePageText` handler.

**Q: Does retry count toward the activity retry limit?**
A: No. The update handler triggers a fresh activity execution with its own retry budget (3 attempts).

## See Also

- `WORKFLOW_HARDENING_SUMMARY.md` - Full implementation details
- `temporal/src/workflows/bookCreation.workflow.ts` - Source code
- `temporal/src/workflows/pageRender.workflow.ts` - Child workflow alternative

