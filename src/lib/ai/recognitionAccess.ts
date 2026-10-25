import { createServerSupabaseClient } from "@/lib/supabase/server";

const windows = new Map<string, { count: number; until: number }>();
function consume(key: string, limit: number, duration: number) {
  const now = Date.now();
  for (const [id, value] of windows) if (value.until <= now) windows.delete(id);
  const bucket = windows.get(key) ?? { count: 0, until: now + duration };
  windows.set(key, bucket);
  if (bucket.count >= limit) return Math.ceil((bucket.until - now) / 1000);
  bucket.count++;
  return 0;
}

export async function authorizeRecognition(request: Request): Promise<Response | null> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Solicitud de reconocimiento no autorizada." }, { status: 403 });
  }
  const demo = request.headers.get("x-recognition-mode") === "demo";
  let identity: string;
  if (demo) {
    if (!["carlos", "mateo"].includes(request.headers.get("x-demo-profile") ?? "")) {
      return Response.json({ error: "Selecciona un perfil demo válido." }, { status: 403 });
    }
    // Public demo access shares a small budget; caller-supplied identities cannot reset it.
    identity = "public-demo";
  } else {
    try {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return Response.json({ error: "Inicia sesión para reconocer productos." }, { status: 401 });
      identity = `user:${data.user.id}`;
    } catch {
      return Response.json({ error: "No se pudo verificar la sesión. Intenta otra vez." }, { status: 503 });
    }
  }
  // Budgets are per server process, with a global ceiling for API spending.
  const retry = consume(`${identity}:minute`, demo ? 3 : 6, 60_000)
    || consume(`${identity}:hour`, demo ? 20 : 40, 3_600_000)
    || consume("global:hour", 100, 3_600_000);
  return retry ? Response.json({ error: "Se alcanzó el límite de reconocimiento. Espera antes de reintentar." }, {
    status: 429, headers: { "Retry-After": String(retry) },
  }) : null;
}
