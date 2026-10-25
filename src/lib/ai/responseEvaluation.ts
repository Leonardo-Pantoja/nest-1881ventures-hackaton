import { explanationSchema, type Explanation, type ToolResult } from "./schemas";

export const FOLLOW_UPS = {
  savings: "¿Quieres revisar un plan de ahorro con las aportaciones que ya tienes comprometidas?",
  compare: "¿Qué precio tiene la alternativa que quieres comparar?",
  update: "¿Tus ingresos, vencimientos y gastos registrados están actualizados?",
  priority: "Si tus metas compiten por dinero, ¿cuál quieres priorizar?",
  price: "¿Qué producto y precio en MXN quieres revisar?",
  contribution: "¿Qué plazo o aportación semanal quieres simular?",
} as const;

/** Reproducible five-dimensional rubric on the actual structured model output.
 * A critical consistency failure rejects the answer regardless of the sum. */
export function evaluateExplanation(tool: ToolResult, candidate: unknown) {
  const parsed = explanationSchema.safeParse(candidate);
  const ids = parsed.success ? parsed.data.factIds : [];
  const known = ids.every(id => tool.facts.some(f => f.id === id));
  const unique = new Set(ids).size === ids.length;
  const covered = (filter: (id: string) => boolean) => tool.facts.filter(f => f.required && filter(f.id)).every(f => ids.includes(f.id));
  const complete = tool.facts.filter(f => f.required).every(f => ids.includes(f.id));
  const dimensions = {
    numericAccuracy: parsed.success && known ? 2 : 0,
    stateInterpretation: parsed.success && covered(id => /assessment|balance|diagnosis|incomplete|missing|unknown|available|clarify/.test(id)) ? 2 : 0,
    riskIdentification: parsed.success && covered(id => /risk|limit|incomplete|unknown|projection|condition/.test(id)) ? 2 : 0,
    noFabrication: parsed.success && known && unique ? 2 : 0,
    clarity: parsed.success && complete && unique ? 2 : 0,
  };
  const score = Object.values(dimensions).reduce((a, b) => a + b, 0);
  const criticalFailure = !parsed.success || !known || !unique || !complete;
  return { dimensions, score, criticalFailure, verdict: criticalFailure || score <= 6 ? "rechazada" : score < 9 ? "necesita_revision" : "aprobada" };
}

export function renderExplanation(tool: ToolResult, explanation: Explanation) {
  const quality = evaluateExplanation(tool, explanation);
  if (quality.verdict !== "aprobada") throw Error("inconsistent_financial_response");
  return explanation.factIds.map(id => tool.facts.find(f => f.id === id)!.text).join("\n\n") + "\n\n" + FOLLOW_UPS[explanation.followUp];
}

export function deterministicExplanation(tool: ToolResult) {
  return renderExplanation(tool, { factIds: tool.facts.filter(f => f.required).map(f => f.id), followUp: tool.product ? "contribution" : "price" });
}
