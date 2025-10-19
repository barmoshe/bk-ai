import OpenAI from 'openai';
import { imageConfig } from '../shared';

let client: OpenAI | undefined;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

async function moderate(text: string): Promise<void> {
  if (process.env.OPENAI_MODERATION !== 'true') return;
  try {
    await getClient().moderations.create({ model: 'omni-moderation-latest', input: text } as any);
  } catch {}
}

export async function generateImageUrl(args: {
  prompt: string;
  size?: string; // e.g., '1024x1024'
  quality?: 'standard' | 'hd';
  background?: 'transparent';
}): Promise<string> {
  const size = args.size || '1024x1024';
  const quality = (args.quality || 'standard') as any;
  await moderate(args.prompt);

  // Simple provider path using REST for gpt-image-1 (supports background)
  if (String(process.env.IMAGE_PROVIDER || '') === 'openai_simple') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: imageConfig.model,
        prompt: args.prompt,
        size,
        background: args.background,
        n: 1,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Image API ${response.status}: ${errText}`);
    }
    const json: any = await response.json();
    const imageUrl = json.data?.[0]?.url;
    if (!imageUrl) throw new Error('Missing image URL in response');
    return imageUrl;
  }

  // Fallback loop across models/sizes for resilience
  const modelsCsv = process.env.OPENAI_IMAGE_FALLBACKS || 'gpt-image-1,dall-e-3,dall-e-2';
  const sizesCsv = process.env.OPENAI_IMAGE_REDUCE_SIZES || '1024x1024,768x768,512x512';
  const models = modelsCsv.split(',').map(s => s.trim());
  const sizes = sizesCsv.split(',').map(s => s.trim());
  const preferred = process.env.OPENAI_IMAGE_MODEL || models[0];

  for (const model of [preferred, ...models.filter(m => m !== preferred)]) {
    for (const sz of [size, ...sizes.filter(s => s !== size)]) {
      try {
        const isGptImage = /gpt-image-1/i.test(model);
        const req: any = {
          model: model as any,
          prompt: args.prompt,
          size: sz as any,
          response_format: isGptImage ? 'b64_json' : 'url',
        };
        if (!isGptImage) req.quality = quality;
        if (isGptImage && args.background) req.background = args.background;
        const res = await getClient().images.generate(req);
        const first = (res as any).data?.[0];
        if (first?.url) return first.url as string;
        if (first?.b64_json) {
          // No URL available; upload step not handled here. Throw to try next size/model.
          throw new Error('Received b64_json without URL');
        }
      } catch (e: any) {
        const msg = String(e?.message || e);
        const retriable = /429|quota|rate|timeout|Too Many Requests/i.test(msg) || /403/.test(msg);
        if (!retriable && !/dall-e-3|dall-e-2|gpt-image-1/.test(model)) throw e;
      }
    }
  }
  throw new Error('All image generation fallbacks failed');
}


