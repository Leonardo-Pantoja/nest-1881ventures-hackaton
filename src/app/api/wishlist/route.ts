import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { wishlistPlanSchema, wishlistProductKey } from "@/lib/finance/wishlistPlan";

const requestSchema = z.object({ accountId: z.string().min(1).max(128), item: wishlistPlanSchema }).strict();
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Solicitud no autorizada." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "Usa una solicitud JSON." }, { status: 415, headers });
  const text = await request.text();
  if (text.length > 4000) return Response.json({ error: "Solicitud demasiado grande." }, { status: 413, headers });
  let body;
  try { body = requestSchema.safeParse(JSON.parse(text)); }
  catch { return Response.json({ error: "JSON inválido." }, { status: 400, headers }); }
  if (!body.success) return Response.json({ error: "Confirma el producto, precio y plan de ahorro." }, { status: 400, headers });
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ error: "Inicia sesión para guardar el plan." }, { status: 401, headers });
    if (user.id !== body.data.accountId) return Response.json({ error: "La cuenta cambió. Vuelve a abrir el plan." }, { status: 409, headers });
    const item = body.data.item;
    const { data, error } = await supabase.rpc("save_wishlist_plan_checked_v1", {
      p_name: item.name, p_price: item.price, p_strategy: item.strategy,
      p_cooldown_days: item.cooldownDays ?? 7,
      p_planned_weekly_save: item.strategy === "microsave" ? item.plannedWeeklySave : null,
      p_plan_weeks: item.strategy === "microsave" ? item.planWeeks ?? null : null,
    });
    if (error) {
      const setupMissing = error.code === "PGRST202" || error.code === "42883";
      return Response.json({ error: setupMissing
        ? "El guardado de planes aún no está disponible. Tu producto sigue seleccionado para que puedas reintentar."
        : error.code === "22023" ? "No se pudo guardar este plan. Revisa el producto, su estado y la aportación."
        : "Supabase no confirmó el guardado. Puedes reintentar este mismo plan.", code: setupMissing ? "wishlist_setup_required" : "wishlist_save_failed" },
      { status: error.code === "22023" ? 422 : 503, headers });
    }
    // Read the receipt back under the authenticated owner's RLS before displaying success.
    if (!data || typeof data.id !== "string") throw Error("invalid_receipt");
    const receipt = await supabase.from("wishlist_items").select("*").eq("user_id", user.id).eq("id", data.id).maybeSingle();
    const row = receipt.data;
    if (receipt.error || !row || row.user_id !== user.id || wishlistProductKey(row) !== wishlistProductKey(item) || Number(row.price) !== item.price
      || row.strategy !== item.strategy || item.strategy === "microsave" && (Number(row.planned_weekly_save) !== item.plannedWeeklySave
        || (row.plan_weeks ?? null) !== (item.planWeeks ?? null))) throw Error("unconfirmed_receipt");
    return Response.json({ item: row, xpAwarded: Number(data.xp_awarded ?? 0),
      wisdomXp: Number(data.wisdom_xp), streakCount: Number(data.streak_count) }, { headers });
  } catch {
    return Response.json({ error: "No recibimos confirmación del guardado. Reintenta el mismo plan para recuperar su resultado." }, { status: 503, headers });
  }
}
