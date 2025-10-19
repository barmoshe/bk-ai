import sharp from 'sharp';
import { composePage } from '../activities/render.activities';
import { buildLayoutMetadata } from '../lib/layout';

async function makePng(w: number, h: number, color: string): Promise<Buffer> {
  const base = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const svg = `<svg width="${w}" height="${h}"><rect x="${Math.floor(w*0.2)}" y="${Math.floor(h*0.2)}" width="${Math.floor(w*0.6)}" height="${Math.floor(h*0.6)}" fill="${color}"/></svg>`;
  return await sharp(base).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

describe('composePage integration', () => {
  it('composes JPEG with layers and text', async () => {
    const layout = buildLayoutMetadata({ text: 'Hello world', stylePackId: 'storybook_watercolor', seed: 'seed' });
    const charPng = await makePng(512, 512, '#ff0000');
    const deco1 = await makePng(256, 256, '#00ff00');
    const deco2 = await makePng(256, 256, '#0000ff');
    const jpg = await composePage({ layout, text: 'Hello world', characterPng: charPng, decor1Png: deco1, decor2Png: deco2 });
    expect(jpg.length).toBeGreaterThan(1000);
  });
});


