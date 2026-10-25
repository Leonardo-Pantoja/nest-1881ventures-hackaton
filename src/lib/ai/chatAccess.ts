import { createServerSupabaseClient } from "../supabase/server";
import { EvaluationRequestError } from "../finance/accountSnapshot";
import type { ChatRequest } from "./schemas";

const buckets = new Map<string, { count: number; until: number }>();
const active = new Set<string>();
const seen = new Map<string, { digest: string; until: number }>();
function budget(key: string, limit: number, duration: number) {
  const now = Date.now();
  for (const [id, b] of buckets) if (b.until <= now) buckets.delete(id);
  const bucket = buckets.get(key) ?? { count: 0, until: now + duration };
  if (bucket.count >= limit) throw new EvaluationRequestError("Alcanzaste el límite del chat. Espera un minuto y vuelve a intentar.", 429, "chat_rate_limit");
  bucket.count++; buckets.set(key, bucket);
}
export async function authorizeChat(body: ChatRequest) {
  if (body.mode === "demo") {
    if (!body.demoProfileId) throw new EvaluationRequestError("Selecciona un perfil demo válido.", 400, "invalid_demo_profile");
    return "public-demo";
  }
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new EvaluationRequestError("Inicia sesión para consultar tu copiloto.", 401, "authentication_required");
    return data.user.id;
  } catch (error) {
    if (error instanceof EvaluationRequestError) throw error;
    throw new EvaluationRequestError("No se pudo verificar tu sesión.", 503, "session_verification_failed");
  }
}
export function acquireChat(identity: string, requestId: string, digest: string, useAI: boolean) {
  const now = Date.now();
  for (const [key, value] of seen) if (value.until <= now) seen.delete(key);
  const key = `${identity}:${requestId}`;
  if (seen.has(key)) throw new EvaluationRequestError("Esta consulta ya se recibió. Envía un nuevo intento explícito.", 409, seen.get(key)?.digest === digest ? "duplicate_request" : "request_id_conflict");
  if (active.has(identity)) throw new EvaluationRequestError("Ya hay una consulta en proceso. Espera a que termine.", 409, "chat_in_progress");
  budget(`${identity}:minute`, useAI ? 6 : 20, 60_000);
  if (useAI) { budget(`${identity}:hour`, 40, 3_600_000); budget("global:hour", 100, 3_600_000); }
  seen.set(key, { digest, until: now + 120_000 });
  active.add(identity);
  return () => active.delete(identity);
}

export async function readChatBody(request: Request): Promise<unknown> {
  const max = 32 * 1024;
  if (Number(request.headers.get("content-length")) > max) throw new EvaluationRequestError("La consulta es demasiado larga.", 413, "request_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new EvaluationRequestError("Falta la consulta.", 400, "invalid_request");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new EvaluationRequestError("La consulta es demasiado larga.", 413, "request_too_large"); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof EvaluationRequestError) throw error;
    throw new EvaluationRequestError("La consulta JSON no es válida.", 400, "invalid_request");
  } finally { reader.releaseLock(); }
}
