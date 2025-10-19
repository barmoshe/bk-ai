import sharp from 'sharp';
import { cleanPng } from '../lib/imageIO';

describe('cleanPng', () => {
  it('rejects fully opaque images', async () => {
    const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } }).png().toBuffer();
    await expect(cleanPng(png)).rejects.toThrow();
  });
});


