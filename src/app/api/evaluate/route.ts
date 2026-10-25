import { NextResponse } from "next/server";
import { z } from "zod";
import { InvalidDemoProfileError, resolveEvaluationProfile } from "@/lib/finance";
import { EvaluationRequestError, loadAccountSnapshot } from "@/lib/finance/accountSnapshot";
import { buildDeterministicEvaluation } from "@/lib/finance/evaluation";
import { validPurchasePrice } from "@/lib/finance/money";
import { readChatBody } from "@/lib/ai/chatAccess";
import { fallbackIntent } from "@/lib/ai/financialAssistant";
import { executeFinancialTool } from "@/lib/ai/financialTools";
import { deterministicExplanation } from "@/lib/ai/responseEvaluation";
import { identifiedProductName } from "@/lib/ai/productContext";
import { productContextSchema, type ChatRequest } from "@/lib/ai/schemas";
import type { OnboardingProfile } from "@/lib/onboarding/financialTypes";
export type { EvaluateApiResponse } from "@/lib/finance/evaluation";

// Legacy conversational callers may send userQuestion and confirmed product context.
// Unknown properties are discarded; browser balances/reports are never financial evidence.
const evaluateRequestSchema = z.object({
  itemName: z.string().trim().max(200).optional(),
  itemPrice: z.number().finite().nullable().optional(),
  summary: z.boolean().optional(),
  mode: z.enum(["account", "demo"]).optional(),
  demoProfileId: z.string().max(100).optional(),
  userQuestion: z.string().trim().max(1500).optional(),
  product: productContextSchema.nullable().optional(),
  pendingProductName: z.string().trim().min(1).max(200).optional(),
  chatMessages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1500) })).max(20).optional(),
});
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const parsed = evaluateRequestSchema.safeParse(await readChatBody(request));
    if (!parsed.success) throw new EvaluationRequestError("Revisa el nombre, el precio y la longitud de tu consulta.", 400, "invalid_request");
    const body = parsed.data;
    const summary = body.summary === true;
    const itemName = body.itemName ?? "";
    const itemPrice = body.itemPrice ?? null;
    const userQuestion = body.userQuestion ?? "";
    if (itemPrice !== null && !validPurchasePrice(itemPrice)) {
      throw new EvaluationRequestError("El precio debe ser positivo en MXN, con hasta dos decimales.", 400, "invalid_price");
    }
    if (!summary && !userQuestion && !itemName && !body.product) {
      throw new EvaluationRequestError("Indica el producto y su precio, o la pregunta que quieres revisar.", 400, "missing_query");
    }

    let revision: string | undefined;
    let profile: OnboardingProfile;
    try {
      profile = await resolveEvaluationProfile(body, async () => {
        const snapshot = await loadAccountSnapshot();
        revision = snapshot.revision;
        return snapshot.profile;
      });
    } catch (error) {
      if (error instanceof InvalidDemoProfileError) throw new EvaluationRequestError(error.message, 400, "invalid_demo_profile");
      throw error;
    }

    if (summary) {
      return NextResponse.json({ ...buildDeterministicEvaluation("Resumen financiero", null, profile), financialRevision: revision }, { headers });
    }

    if (userQuestion || itemPrice === null && !body.product) {
      const confirmedName = identifiedProductName(itemName);
      const confirmedProduct = confirmedName && itemPrice !== null ? { name: confirmedName, price: itemPrice } : body.product ?? null;
      const query: ChatRequest = {
        requestId: "00000000-0000-4000-8000-000000000000", message: userQuestion || `¿Puedo comprar ${itemName}?`,
        history: (body.chatMessages ?? []).filter(message => message.role === "user" && message.content.trim()).slice(-10)
          .map(message => ({ role: "user", content: message.content })),
        product: confirmedProduct, pendingProductName: body.pendingProductName,
        mode: body.mode ?? "account", demoProfileId: body.demoProfileId === "mateo" || body.demoProfileId === "carlos" ? body.demoProfileId : undefined,
        deterministicOnly: true,
      };
      const intent = fallbackIntent(query);
      const tool = executeFinancialTool(profile, intent, confirmedProduct);
      const evaluatesPurchase = ["purchase", "compare"].includes(intent.operation) && tool.product !== null;
      const purchase = evaluatesPurchase ? tool.product : null;
      const needsPrice = tool.facts.some(fact => fact.id === "missing.price");
      const reply = deterministicExplanation(tool);
      return NextResponse.json({
        ...buildDeterministicEvaluation(purchase?.name ?? "Resumen financiero", purchase?.price ?? null, profile),
        financialRevision: revision, chatReply: reply, aiExplanation: reply,
        ...(needsPrice ? { needsPrice: true, clearProductContext: true, pendingProductName: identifiedProductName(intent.productName) ?? undefined } : {}),
      }, { headers });
    }

    const product = itemPrice !== null ? { name: identifiedProductName(itemName) ?? "Compra sin producto identificado", price: itemPrice } : body.product!;
    return NextResponse.json({ ...buildDeterministicEvaluation(product.name, product.price, profile), financialRevision: revision }, { headers });
  } catch (error) {
    if (error instanceof EvaluationRequestError) return NextResponse.json({
      status: error.httpStatus >= 500 ? "error_procesamiento" : "datos_incompletos", error: error.message, code: error.code,
    }, { status: error.httpStatus, headers });
    return NextResponse.json({ status: "error_procesamiento", error: "No se pudo completar la evaluación financiera.", code: "evaluation_failed" }, { status: 500, headers });
  }
}
