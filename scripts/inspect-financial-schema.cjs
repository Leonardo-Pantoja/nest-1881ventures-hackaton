// Read-only PostgREST metadata inspection. Prints column names, never rows or credentials.
(async () => {
  try {
    const response = await fetch(new URL('/rest/v1/', process.env.NEXT_PUBLIC_SUPABASE_URL), {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Accept: 'application/openapi+json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) { console.log('Schema metadata unavailable: HTTP', response.status); process.exitCode = 1; return; }
    const schema = await response.json();
    for (const table of ['profiles', 'income_sources', 'commitments', 'goals', 'wishlist_items']) {
      console.log(table, Object.keys(schema.definitions?.[table]?.properties ?? {}));
    }
    console.log('RLS policy definitions require a database audit; OpenAPI does not verify RLS.');
  } catch (error) { console.error('Schema inspection failed:', error.cause?.code || error.name); process.exitCode = 1; }
})();
