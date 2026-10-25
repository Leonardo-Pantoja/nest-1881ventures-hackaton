"use client";

import type { EvaluateApiResponse } from "@/lib/finance/evaluation";
import { formatMXN } from "@/lib/finance/money";

/** Display registered facts independently from the completeness of a purchase calculation. */
export default function FinancialDataStatus({ evaluation, loading = false, error, onRetry }: {
  evaluation: EvaluateApiResponse | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (loading) return <p role="status" className="text-xs text-slate-500">Cargando datos financieros registrados…</p>;
  if (error) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
    <p>No se pudieron consultar los datos financieros: {error}</p>
    {onRetry && <button type="button" onClick={onRetry} className="mt-1 font-bold underline">Reintentar carga</button>}
  </div>;
  if (!evaluation) return <p className="text-xs text-slate-500">Aún no hay una evaluación financiera disponible.</p>;
  const known = evaluation.registeredData;
  const incomplete = evaluation.safeToSpend === null;
  const projectionIncomplete = evaluation.projectionStatus === "datos_incompletos";
  const frequencyLabels = { semanal: "semanal", quincenal: "quincenal", mensual: "mensual", variable: "frecuencia variable o sin confirmar" };
  return <div className="space-y-2 text-xs text-slate-600" aria-label="Estado de los datos financieros">
    <p className="font-semibold text-slate-700">{incomplete ? "Datos registrados disponibles · falta información para calcular el margen" : "Margen inmediato calculado con los datos registrados"}</p>
    {known && <dl className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div><dt>Saldo registrado</dt><dd className="font-bold text-slate-800">{known.currentBalance === null ? "Por confirmar" : formatMXN(known.currentBalance)}</dd></div>
      <div><dt>Reserva de seguridad registrada</dt><dd className="font-bold text-slate-800">{known.safetyBuffer === null ? "Por confirmar" : formatMXN(known.safetyBuffer)}</dd></div>
      <div><dt>Gastos esenciales diarios registrados</dt><dd className="font-bold text-slate-800">{known.dailyEssentialBudget === null ? "Por confirmar" : formatMXN(known.dailyEssentialBudget)}</dd></div>
      <div><dt>Otros ahorros protegidos considerados</dt><dd className="font-bold text-slate-800">{known.protectedSavings === null ? "Por confirmar" : formatMXN(known.protectedSavings)}</dd></div>
      {known.incomeSources.map((income, index) => <div key={index}>
        <dt>{known.incomeSources.length === 1 ? "Ingreso registrado" : `Ingreso registrado ${index + 1}`} · {frequencyLabels[income.frequency]}</dt>
        <dd className="font-bold text-slate-800">{income.amount === null ? "Importe por confirmar" : formatMXN(income.amount)}</dd>
        <dd>{income.dateStatus === "overdue" ? "Fecha registrada vencida; confirma el próximo pago" : income.nextPaymentDays === null ? "Próxima fecha por confirmar" : income.nextPaymentDays === 0 ? "Previsto para hoy; confirma recepción" : `Próximo pago registrado en ${income.nextPaymentDays} días`}</dd>
      </div>)}
      {known.incomeSources.length === 0 && <div><dt>Ingresos activos</dt><dd>Sin fuentes confirmadas</dd></div>}
    </dl>}
    {incomplete && evaluation.missingInformation.length > 0 && <ul className="list-disc pl-4 space-y-1 text-amber-800">{evaluation.missingInformation.map(reason => <li key={reason}>{reason}</li>)}</ul>}
    {projectionIncomplete && <p className="text-amber-800">Proyección de seis semanas incompleta. {incomplete ? "No se asumen ingresos ni fechas faltantes." : "El margen inmediato conocido no confirma la viabilidad futura."}</p>}
    {projectionIncomplete && !incomplete && Boolean(evaluation.projectionLimitations?.length) && <p className="text-slate-500">{evaluation.projectionLimitations!.join(" ")}</p>}
  </div>;
}
