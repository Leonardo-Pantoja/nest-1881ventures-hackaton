// Run with: node scripts/test.cjs scripts/diagnose-product-ai.cjs
// Uses one synthetic product image, no account or financial data.
require('@next/env').loadEnvConfig(process.cwd());
const sharp = require('sharp');
const fs = require('node:fs/promises');
const { extractProduct } = require('../src/lib/ai/gemini.ts');
const { prepareProductImage } = require('../src/lib/ai/prepareProductImage.ts');
(async () => {
  const png = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/><text x="80" y="260" font-family="Arial" font-size="64" fill="black">Nintendo Switch OLED</text><text x="80" y="400" font-family="Arial" font-size="80" fill="black">$5,400 MXN</text></svg>')).png().toBuffer();
  // An optional PNG path exercises the same preparation and extraction as an upload.
  const imagePath = process.argv[3];
  const input = imagePath ? await fs.readFile(imagePath) : png;
  const image = await prepareProductImage(new File([input], 'product.png', { type: 'image/png' }));
  const product = await extractProduct({ source: 'image', image, prompt: 'Extract name, price and ISO currency from this product screenshot. Use null when a field is not visible. Return only the required JSON. Do not calculate or invent prices.' });
  if (imagePath) {
    console.log('Diagnostic result:', product);
  } else {
    const passed = !!product.name && product.price === 5400 && product.currency === 'MXN';
    console.log('Diagnostic result:', { identified: !!product.name, priceMatchesFixture: product.price === 5400, currencyMatchesFixture: product.currency === 'MXN' });
    if (!passed) process.exitCode = 1;
  }
})().catch(error => {
  // Provider error objects may contain sensitive request details; log only the mapped code.
  console.error('Diagnostic failed:', { code: error.code ?? 'local_failure', status: error.status ?? 0 });
  process.exitCode = 1;
});
