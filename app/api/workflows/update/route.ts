import { getTemporalClient } from '../../../../lib/temporalClient';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { bookId, type, payload } = body || {};
    if (!bookId || !type) return new Response('Missing bookId/type', { status: 400 });

    const workflowId = `book-${bookId}`;
    const handle = await getTemporalClient().workflow.getHandle(workflowId);

    // One-line debug log with essential context
    console.log('[WF-UPDATE]', JSON.stringify({ ts: new Date().toISOString(), type, bookId, workflowId, payloadType: typeof payload, payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : undefined, payloadPreview: payload ? JSON.stringify(payload).slice(0, 300) : undefined }));

    switch (type) {
      case 'setCharacterSpec': {
        if (!payload || typeof payload !== 'object') return new Response('Invalid payload', { status: 400 });
        await (handle as any).executeUpdate('setCharacterSpec', { args: [payload] });
        break;
      }
      case 'chooseCharacter': {
        if (typeof payload !== 'string') return new Response('Invalid payload', { status: 400 });
        await (handle as any).executeUpdate('chooseCharacter', { args: [payload] });
        break;
      }
      case 'setBookPrefs': {
        if (!payload || typeof payload !== 'object') return new Response('Invalid payload', { status: 400 });
        await (handle as any).executeUpdate('setBookPrefs', { args: [payload] });
        break;
      }
      case 'selectCover': {
        if (typeof payload !== 'string') return new Response('Invalid payload', { status: 400 });
        await (handle as any).executeUpdate('chooseCover', { args: [payload] });
        break;
      }
      case 'pause':
      case 'resume':
      case 'cancel': {
        await (handle as any).executeUpdate(type as any);
        break;
      }
      default:
        return new Response('Unknown update type', { status: 400 });
    }

    return Response.json({ ok: true, type });
  } catch (e: any) {
    return new Response(String(e?.message || e), { status: 500 });
  }
}


