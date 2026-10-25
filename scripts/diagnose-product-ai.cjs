// Run with: node scripts/test.cjs scripts/diagnose-product-ai.cjs
// Uses one synthetic product image, no account or financial data.
require('@next/env').loadEnvConfig(process.cwd());
const sharp = require('sharp');
const { extractProduct } = require('../src/lib/ai/gemini.ts');
const { prepareProductImage } = require('../src/lib/ai/prepareProductImage.ts');
(async () => {
  const png = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/><text x="80" y="260" font-family="Arial" font-size="64" fill="black">Nintendo Switch OLED</text><text x="80" y="400" font-family="Arial" font-size="80" fill="black">$5,400 MXN</text></svg>')).png().toBuffer();
  const image = await prepareProductImage(new File([png], 'synthetic-product.png', { type: 'image/png' }));
  const product = await extractProduct({ source: 'image', image, prompt: 'Extract name, price and ISO currency from this product screenshot. Use null when a field is not visible. Return only the required JSON. Do not calculate or invent prices.' });
  console.log('Diagnostic result:', { identified: !!product.name, priceMatchesFixture: product.price === 5400, currencyMatchesFixture: product.currency === 'MXN' });
})().catch(error => {
  // Provider error objects may contain sensitive request details; log only the mapped code.
  console.error('Diagnostic failed:', { code: error.code ?? 'local_failure', status: error.status ?? 0 });
  process.exitCode = 1;
});
