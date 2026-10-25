
# ANTES DE GASTAR
## Entrega del motor financiero

Responsable: Sebas — DATOS
Destinatario: Leo — Backend e IA

### 1. Estado de la entrega

Motor financiero implementado y probado.

Validaciones realizadas:
- 79 verificaciones funcionales aprobadas.
- 10 escenarios financieros validados.
- TypeScript estricto sin errores reportados.

Pendientes:
- Integración con backend y Supabase.
- Pruebas de respuestas reales de Gemini.
- Validación de casos límite adicionales.

### 2. Archivos principales

src/lib/financialTypes.ts
Modelos y tipos financieros.

src/lib/financialEngine.ts
Cálculo de dinero disponible (Safe-to-Spend).

src/lib/goalImpact.ts
Impacto de retiros explícitos de una meta.

src/lib/weeklyProjection.ts
Simulación de flujo financiero durante 42 días.

src/lib/purchaseDecision.ts
Evaluación de compras contra el margen disponible.

src/lib/purchaseReport.ts
Reporte financiero integrado.

### 3. Función principal para el backend

import { buildPurchaseReport }
  from "./purchaseReport";

const reporte = buildPurchaseReport(
  perfilFinanciero,
  precioCompra
);

Entrada:
- perfilFinanciero: OnboardingProfile
- precioCompra: número positivo en MXN
  con máximo dos decimales.

Salida:
- status
- purchase
- goalImpact
- projectionBefore
- projectionAfter
- projectedBalanceDifference

### 4. Interpretación de estados

report.status:

calculado:
Se obtuvo el reporte. No significa
que la compra sea recomendable.

datos_incompletos:
No se pudo completar el diagnóstico.

saldo_insuficiente:
El precio excede el saldo registrado.

purchase.assessment:

dentro_del_margen:
La compra cabe en el margen calculado.

excede_margen:
La compra supera el margen disponible.

no_evaluable:
Falta información para evaluar.

IMPORTANTE:
Una compra dentro del margen inmediato
puede presentar riesgos en la proyección futura.

### 5. Reglas de datos para integración

- No inventar ingresos ni fechas.
- No duplicar pagos de deuda.
- Las deudas se registran separadas
  de otros compromisos.
- No asumir frecuencias de pagos desconocidas.
- No asumir dónde están los ahorros.
- Si savingsLocation es desconocido,
  conservar el valor "desconocido".
- No presentar datos demo como datos bancarios reales.
- No modificar el perfil original al simular compras.

El frontend actual de Pablo usa un modelo
diferente. Se necesita un adaptador
antes de llamar al motor.

### 6. Limitaciones conocidas

- Safe-to-Spend evalúa principalmente
  el horizonte hasta el siguiente ingreso.
- La proyección supone ingresos periódicos
  de importe constante.
- La simulación no garantiza saldos futuros.
- Las fechas mensuales todavía requieren
  una implementación más precisa.
- Las aportaciones futuras a metas no están
  incluidas automáticamente en la proyección.
- El reporte integrado considera una compra
  pagada desde el saldo actual.
- El efecto de retirar ahorros debe calcularse
  explícitamente; no se infiere de una compra.

No usar estos resultados como garantía
de solvencia o asesoría financiera profesional.

### 7. Documentos para Gemini

docs/financial-ai-criteria.md
Reglas para interpretar resultados financieros.

docs/gemini-test-cases.md
Diez escenarios con resultados esperados.

src/lib/geminiCases.test.ts
Validación automática de los escenarios.

### 8. Responsabilidades

Sebas:
- Mantener las reglas financieras.
- Verificar escenarios y cálculos.
- Evaluar respuestas generadas por Gemini.

Leo:
- Adaptar entradas provenientes de Supabase.
- Conectar el motor al backend.
- Integrar Gemini en /api/evaluate.
- Manejar seguridad y persistencia.

Pablo:
- Mostrar diagnósticos y proyecciones.
- Conectar resultados con la interfaz.

### 9. Criterio de aceptación

La integración debe:
- Utilizar resultados del motor sin modificarlos.
- Manejar explícitamente datos incompletos.
- Mostrar riesgos de liquidez.
- No inventar saldos ni ingresos.
- Conservar las metas y datos originales
  durante una simulación.
- Pasar las pruebas financieras existentes.
