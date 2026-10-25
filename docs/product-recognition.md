# Product recognition

The existing dashboard section supports manual input, preset products and an embedded image upload area. The camera button opens the same review panel. Files can also be dropped onto the upload area.

Typing in the existing input does not trigger Gemini or update the confirmed product. Clicking **Buscar con IA**, or pressing Enter through the explicitly associated `product-ai-search` form, sends one `POST /api/ai/parse-product` request with `{ text }` (1–500 characters). No debounce or recognition effect is used. A synchronous ref lock blocks double submissions before React rerenders; cancellation and component replacement abort the request and discard late results. Text, image and manual input share the same editable confirmation card.

`POST /api/ai/recognize-product` receives an `image` multipart field (JPEG, PNG or WebP, up to 8 MB). `/api/scan` is an alias with identical access restrictions. Only the image and extraction instructions go to Gemini. The SDK reads the existing `GEMINI_API_KEY` and `GEMINI_MODEL` on the server.

Both endpoints return `{ name: string | null, price: number | null, currency: string | null, source: "text" | "image", needsConfirmation: true }`. No prices or exchange rates are estimated. Text parsing defaults to the MXN context and discards generated prices without matching numeric amounts and price context in the original input, including model-number false positives. Written-out amounts may require manual entry. A missing price leaves the review field empty. A foreign currency requires entering the MXN price manually; an unknown currency is explicitly labeled. Confirming requires a name and a positive MXN amount with at most two decimal places.

Confirmation updates only the selected product and pending evaluation, then the existing deterministic financial engine evaluates it. Recognition and confirmation never write purchases, balances, XP, wishlist items or goals. Demo captures use explicit simulated-data labels and the same confirmation step.

## Access and limits

Same-origin POST requests require either a verified Supabase user or explicit demo access (`x-recognition-mode: demo`, `x-demo-profile: carlos|mateo`). Public demo access is deliberately available without signing in, but shares a single budget across both profiles. No financial profile values are accepted by the recognition endpoint.

- Authenticated: 6 requests/minute and 40/hour per user.
- Public demo: 3 requests/minute and 20/hour shared by all demo visitors.
- Global ceiling: 100 requests/hour per server process.

Limits are in memory: they reset on restart and are not shared by multiple workers or deployment instances. Use shared persistent rate limiting before scaling beyond a single instance. HTTP 429 responses include `Retry-After`; provider quota failures and connection failures are shown separately.

## Timeout diagnosis and recovery

The previous image route used a 30,000 ms timeout, forwarded images without resizing and mapped upstream 504, local timeout and other failures to one generic HTTP 502. Those implementation facts are verified; they do not establish Google's internal cause for historical 504 failures.

`src/lib/ai/gemini.ts` now centralizes the configured model, structured response validation and error mapping. Gemini 3 models use `ThinkingLevel.LOW`; Gemini 2.5 Flash uses a zero thinking budget. Other model families receive no unsupported thinking setting. The primary model comes from `GEMINI_MODEL`. An optional `GEMINI_FALLBACK_MODEL` selects the model for the second call only after an upstream 503/504; without it, the same model is retried. Thinking settings are calculated for each model. SDK automatic continuation and retries are disabled. There is at most one application retry after a 750 ms backoff, only for upstream 503/504, within a shared 55-second deadline. Local timeouts, 400, 401, 403, 429 and validation errors are not retried automatically. Routes advertise `maxDuration = 60`; the hosting platform must actually allow that duration.

Image decoding uses Sharp, validates MIME against decoded contents, caps input at 40 megapixels, strips metadata and converts to JPEG quality 88 with a maximum dimension of 2560 pixels without enlargement. Only the normalized image is sent to Gemini. Preview data stays in the browser.

Server `product_ai` logs contain model, source, attempt, duration, mapped code/status, upstream status and original/sent image sizes. They never contain keys, provider error messages, prompts, image contents or financial data. Error codes distinguish `gemini_local_timeout`, `gemini_upstream_504`, `gemini_upstream_503`, `gemini_validation`, `gemini_quota` and connection failures. The UI exposes manual retry.

A live synthetic-image check using the existing `gemini-3.8-flash` model completed in 27,815 ms and correctly identified the fixture product, 5400 price and MXN currency. It did not reproduce an upstream 504 and is not a guarantee against future provider failures. To repeat this explicit, quota-consuming check, run `node scripts/test.cjs scripts/diagnose-product-ai.cjs`.

## Local provider availability check (2026-10-25)

The configured `gemini-3.8-flash` returned HTTP 503 twice on a synthetic image through `generateContent`; a separate minimal Interactions request also returned 503. A minimal `gemini-3.6-flash` text request succeeded. Testing the supplied Amazon PNG through the real image preparation and extraction service with `gemini-3.6-flash` returned `Metroid™ Ravenous`, `1449`, `MXN` after one upstream 503 and the existing retry (34.4 seconds total). The local `.env` model was initially changed explicitly to `gemini-3.6-flash`, but subsequent uploads continued returning upstream 503. This successful check does not guarantee provider availability.

Follow-up checks with the same Amazon screenshot returned the correct product, `1449`, and `MXN` using `gemini-3.5-flash-lite` in 1.6 seconds on the first attempt and `gemini-3.1-flash-lite` in 5.3 seconds after a retry. The current local configuration is `GEMINI_MODEL=gemini-3.5-flash-lite` and `GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite`. There are still at most two calls and a shared 55-second deadline. Authentication, quota, validation, cancellation and local timeout failures do not trigger fallback. Provider outages affecting both models can still return an error. Production must configure these variables separately because `.env` is ignored by Git.

To test a PNG through the same service, run `node scripts/test.cjs scripts/diagnose-product-ai.cjs "/absolute/path/product.png"`. This sends that image to the configured Gemini model and prints the extracted product fields locally. The synthetic diagnostic remains the default and exits unsuccessfully if the expected fields do not match.

## Manual verification

1. Run `npm run dev` and open `/app` with an authenticated account or a demo profile.
2. Type “Nintendo Switch OLED de 5400 pesos”. In the browser Network tab, verify typing makes no requests to `/api/ai/*`. Click “Buscar con IA” or press Enter and verify one parse request.
3. Repeat with “Laptop Lenovo IdeaPad”; the price must remain blank until entered manually. Edit the price, cancel or confirm. Recognition alone must not send a product evaluation.
4. Select or drop a store screenshot with a visible name, price and currency.
5. Verify the detected fields, edit them and choose “Confirmar y evaluar”. Check the existing financial result and its three decisions.
6. Try a photo without a price. Confirm that the field is blank and confirmation requires a positive price.
7. Cancel, select a preset product during recognition, or switch accounts. Previous results must not replace the current selection.
8. Verify that scanning and confirming leave balances, XP and financial records unchanged.

## Automated verification

Run `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build`. Automated recognition tests mock Gemini and do not consume API quota. Image preparation tests decode and resize real generated images. Component-handler tests cover explicit text submission, typing without requests, duplicate locking, confirmation, editing, cancellation, drag-and-drop, API failures and late responses; they are not browser end-to-end tests. Service tests cover retry bounds, local/upstream timeout distinctions and log redaction.

The global lint command currently reports three unrelated existing errors: two unescaped JSX quotes in `ExpensePlanView.tsx:1130` and a render-scoped variable reassignment in `GoalsAndCoolingView.tsx:264`. These components were left unchanged.

## Files for the text and timeout update

Created:

- `src/lib/ai/gemini.ts`
- `src/lib/ai/prepareProductImage.ts`
- `src/app/api/ai/parse-product/route.ts`
- `scripts/diagnose-product-ai.cjs`
- `tests/gemini-service.test.cjs`
- `tests/parse-product-api.test.cjs`
- `tests/product-image.test.cjs`

Modified:

- `src/app/app/page.tsx`
- `src/components/QuickSnapScanner.tsx`
- `src/app/api/ai/recognize-product/route.ts`
- `src/app/api/scan/route.ts`
- `tests/scan-api.test.cjs`
- `tests/scanner-confirmation.test.cjs`
- `package.json` and `package-lock.json` (Sharp was already installed through Next.js; it is now a direct dependency)
- `docs/product-recognition.md`
