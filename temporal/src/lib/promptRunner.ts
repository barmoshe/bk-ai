import OpenAI from 'openai';
import { saveArtifact, recordPromptRun } from './promptRecorder';
import { config } from '../shared';
import { fetchWithRetry } from './http';

const DEFAULT_TIMEOUT_MS = config.timeouts.prompt;

let client: OpenAI | undefined;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: config.getApiKey() });
  return client;
}

export interface SchemaSpec {
  name: string;
  schema: any;
}

export interface PromptCall {
  bookId: string;
  step: string;
  version?: string;
  model: string;
  temperature?: number;
  system: string;
  user: string;
  schema?: SchemaSpec;
  timeoutMs?: number;
  idempotencyKey?: string;
}

export async function runStructuredPrompt<T = any>(call: PromptCall): Promise<T> {
  const started = Date.now();
  const timeoutMs = call.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const recordBase = {
    step: call.step,
    version: call.version,
    model: call.model,
    temperature: call.temperature,
    startedAt: new Date(started).toISOString(),
    input: { system: call.system, user: call.user, schema: call.schema?.name },
  } as any;

  let text: string | undefined;
  // Prefer Responses API when available (json_schema), else fall back to chat.completions
  try {
    const anyClient: any = getClient();
    if (call.schema && anyClient?.responses?.create) {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await anyClient.responses.create({
          model: call.model,
          temperature: call.temperature,
          response_format: { type: 'json_schema', json_schema: { name: call.schema.name, schema: call.schema.schema, strict: true } },
          input: [
            { role: 'system', content: call.system },
            { role: 'user', content: call.user },
          ],
        }, { signal: controller.signal });
        text = (resp as any)?.output_text
          || (resp as any)?.choices?.[0]?.message?.content
          || JSON.stringify((resp as any)?.output?.[0]?.content?.[0]?.text || {});
      } finally {
        clearTimeout(to);
      }
    }
  } catch {}

  if (!text) {
    // Fallback to REST with Retry-After-aware retries and optional idempotency
    const body = JSON.stringify({
      model: call.model,
      temperature: call.temperature,
      response_format: call.schema ? ({ type: 'json_object' } as any) : undefined,
      messages: [
        { role: 'system', content: call.system },
        { role: 'user', content: call.user },
      ],
    });
    const res = await fetchWithRetry({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.getApiKey()}`, 'Content-Type': 'application/json' },
      body,
      timeoutMs,
      idempotencyKey: call.idempotencyKey || `chat:${call.bookId}:${call.step}`,
      maxAttempts: 2,
    });
    const json: any = await res.json();
    text = (json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) ? json.choices[0].message.content : '';
  }

  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }

  const finished = Date.now();
  await recordPromptRun(call.bookId, `${call.step}.record`, {
    ...recordBase,
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - started,
    output: { textLength: typeof text === 'string' ? text.length : 0 },
  });
  await saveArtifact(call.bookId, `${call.step}-response.json`, { text });

  return parsed as T;
}


