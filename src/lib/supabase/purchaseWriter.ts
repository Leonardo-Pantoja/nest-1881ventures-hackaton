import { createClient } from "@supabase/supabase-js";
import { EvaluationRequestError } from "../finance/accountSnapshot";

// This module must only be imported by server route handlers.
export function createPurchaseWriter() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new EvaluationRequestError(
      "El registro seguro requiere configurar la credencial privada del servidor.",
      503,
      "purchase_writer_not_configured",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
