const assert = require('node:assert/strict');
const { test } = require('node:test');
const sharp = require('sharp');
const { prepareProductImage } = require('../src/lib/ai/prepareProductImage.ts');
test('reduces large images and preserves smaller image dimensions', async () => {
  for (const width of [3200, 600]) {
    const original = await sharp({ create: { width, height: width / 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const result = await prepareProductImage(new File([original], 'capture.png', { type: 'image/png' }));
    const info = await sharp(result.bytes).metadata();
    assert.equal(info.format, 'jpeg'); assert.equal(info.width, Math.min(width, 2560)); assert.equal(result.originalBytes, original.length);
  }
});
test('rejects undecodable bytes and MIME/content mismatches', async () => {
  await assert.rejects(prepareProductImage(new File(['not an image'], 'fake.png', { type: 'image/png' })), error => error.code === 'invalid_image');
  const jpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  await assert.rejects(prepareProductImage(new File([jpeg], 'fake.png', { type: 'image/png' })), error => error.status === 400);
});
