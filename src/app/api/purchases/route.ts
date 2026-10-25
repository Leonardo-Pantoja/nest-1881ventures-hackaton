import { NextResponse } from "next/server";
import { EvaluationRequestError, loadAccountSnapshot } from "@/lib/finance/accountSnapshot";
import { buildDeterministicEvaluation } from "@/lib/finance/evaluation";
import { validPurchasePrice } from "@/lib/finance/money";
import { createPurchaseWriter } from "@/lib/supabase/purchaseWriter";

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body.itemName !== "string" || !body.itemName.trim() || body.itemName.length > 180 ||
    !validPurchasePrice(body.itemPrice) || typeof body.operationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.operationId) ||
    typeof body.financialRevision !== "string") return NextResponse.json({ error: "Confirma el producto, precio y evaluación." }, { status: 400 });
  try {
    const snapshot = await loadAccountSnapshot();
    const { supabase, userId } = snapshot;
    // Never fall back to the legacy RPC: its transaction guarantees are unknown.
    const receipt = await supabase.from("purchase_operations").select("item_name, price, current_balance")
      .eq("user_id", userId).eq("operation_id", body.operationId).maybeSingle();
    if (receipt.error) throw new EvaluationRequestError("El registro seguro de compras requiere verificar la configuración de Supabase.", 503, "purchase_storage_unverified");
    if (receipt.data) {
      if (receipt.data.item_name !== body.itemName.trim() || Number(receipt.data.price) !== body.itemPrice) return NextResponse.json({ error: "La confirmación ya pertenece a otra compra." }, { status: 409 });
      return NextResponse.json({ currentBalance: Number(receipt.data.current_balance), replayed: true });
    }
    if (body.financialRevision !== snapshot.revision) return NextResponse.json({ error: "Tus datos financieros cambiaron. Actualiza la evaluación antes de confirmar." }, { status: 409 });
    const evaluation = buildDeterministicEvaluation(body.itemName.trim(), body.itemPrice, snapshot.profile);
    if (evaluation.status === "datos_incompletos" || snapshot.profile.currentBalance === null) return NextResponse.json({ error: "Faltan datos financieros para registrar esta compra." }, { status: 422 });
    if (body.itemPrice > snapshot.profile.currentBalance) return NextResponse.json({ error: "Saldo insuficiente." }, { status: 422 });
    const writer = createPurchaseWriter();
    const { data, error } = await writer.rpc("record_purchase_checked_v1", {
      p_user_id: userId,
      p_operation_id: body.operationId, p_name: body.itemName.trim(), p_price: body.itemPrice,
      p_expected_snapshot: snapshot.raw,
    });
    if (error) {
      if (error.code === "40001" || error.code === "23505") return NextResponse.json({ error: "Tus datos cambiaron. Revisa la evaluación y vuelve a intentarlo." }, { status: 409 });
      if (error.code === "22023") return NextResponse.json({ error: "La compra no cumple las validaciones de saldo, precio o confirmación." }, { status: 422 });
      throw new EvaluationRequestError("No recibimos confirmación de Supabase. Reintenta esta misma compra para consultar su recibo.", 503, "purchase_storage_unavailable");
    }
    const balance = Number(data?.current_balance);
    if (!data || !Number.isFinite(balance) || balance < 0) throw new EvaluationRequestError("Supabase no confirmó el resultado. Reintenta esta misma confirmación.", 503, "invalid_purchase_receipt");
    return NextResponse.json({ currentBalance: balance });
  } catch (error) {
    if (error instanceof EvaluationRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    return NextResponse.json({ error: "No se pudo confirmar la compra. Reintenta esta misma confirmación." }, { status: 503 });
  }
}
