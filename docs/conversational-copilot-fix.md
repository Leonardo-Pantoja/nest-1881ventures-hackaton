# Corrección del copiloto financiero conversacional

Fecha: 25 de octubre de 2026.

## Causa comprobada

El problema principal estaba en la explicación. Gemini interpretaba el mensaje, pero la segunda llamada recibía una biblioteca de hechos, sin la pregunta actual ni la pregunta anterior del asistente. Su salida seleccionaba identificadores de hechos y una pregunta de un catálogo; el servidor reconstruía los párrafos financieros obligatorios. Por eso distintos turnos terminaban mostrando casi el mismo reporte aunque el proveedor hubiera respondido correctamente. La etiqueta de Gemini tampoco dejaba claro cuánto del texto procedía de esa plantilla.

El cliente conservaba mensajes visibles, pero solo enviaba los del usuario. No existía un estado validado que conservara la pregunta pendiente del asistente, la declaración de ingresos o la última intención entre confirmaciones. Una confirmación podía terminar en otra evaluación de compra. El fallback determinista era una segunda causa posible de texto repetido, pero no explica por sí solo el diseño anterior; las pruebas distinguen el fallo del proveedor de una explicación exitosa.

Ahora Gemini interpreta la intención y redacta una respuesta nueva con la pregunta actual y contexto relevante. Los hechos críticos y las cifras siguen siendo controlados por el servidor. Una respuesta determinista se identifica como respaldo, con aviso y reintento cuando el proveedor falla.

## Contexto y aislamiento

`conversationState.ts` firma un contexto acotado con HMAC. Conserva producto, último precio, nombre pendiente, intención financiera anterior, declaración conversacional de ingresos, pregunta pendiente, temas ya preguntados, respuesta anterior y hasta cinco mensajes de usuario de 600 caracteres. Caduca después de 30 minutos de inactividad.

El contexto está vinculado a la identidad verificada, modo y perfil demo. Una firma modificada, caducada o de otra cuenta devuelve `conversation_changed` antes de consultar datos o Gemini. El historial enviado con un contexto válido se sustituye por el firmado. Sin contexto previo, producto e historial iniciales son información hipotética y conversacional; nunca prueban saldo, ingresos o compromisos.

Cada turno autenticado vuelve a obtener la instantánea de Supabase con Auth y filtros del propietario. La respuesta histórica no aporta cifras autoritativas al turno siguiente. El frontend se reinicia al cambiar cuenta o revisión financiera; **Nueva conversación** cancela la solicitud y limpia mensajes, token y producto. Escribir y cambiar sugerencias no ejecuta solicitudes.

La clave puede ser `CHAT_CONTEXT_SECRET`; si no existe se usa `GEMINI_API_KEY` y, sin ambas, una clave efímera del proceso. La clave debe ser estable entre instancias para conservar conversaciones en un despliegue distribuido. El token está firmado, no cifrado; no se registra en logs.

## Intenciones y herramientas

| Pregunta | Ejecución |
| --- | --- |
| Compra o comparación de precio | Resuelve el producto y precio confirmados, ejecuta el reporte existente y conserva los riesgos relevantes. |
| Dinero disponible | Consulta Safe-to-Spend y proyección por separado, sin crear una compra ficticia. Si falta margen, muestra los datos registrados que sí existen. |
| Objetivo o tiempo de ahorro | Calcula la aritmética del objetivo en centavos y, de forma independiente, la capacidad sostenible con el motor existente. |
| Esperar un plazo explícito | Usa ese plazo en la proyección existente, dentro de su horizonte. No sustituye dos semanas por el próximo pago. Sin calendario suficiente muestra únicamente la aritmética comprobable de gastos. |
| Esperar al próximo ingreso | Solo usa ese escenario si el mensaje actual lo solicita expresamente y el calendario permite simularlo. |
| Compromisos y prioridades | Consulta pagos, deudas y reglas existentes de protección de necesidades y reservas; distingue fechas conocidas de vencimientos pendientes. |
| Metas, reserva o retiro hipotético | Reutiliza las herramientas existentes; no mueve dinero ni retira automáticamente fondos. |
| Confirmación o declaración de ingresos | Reconoce el mensaje sin volver a construir el reporte de compra. Actualizado no significa completo. |
| Seguimiento o información faltante | Resuelve la intención financiera anterior y hace como máximo una pregunta pertinente, evitando repetir la anterior. |

La interpretación de Gemini tiene esquema validado. Los importes y plazos extraídos se contrastan con el mensaje y producto válidos. La ruta de compatibilidad `/api/evaluate` solo construye un reporte de compra para compra/comparación; ahorro y espera ya no crean una compra artificial.

Una declaración propia de ausencia de ingresos o de ingresos variables se conserva solo en la conversación. Las preguntas hipotéticas sobre quedarse sin ingresos no actualizan esa declaración. Si contradice la nómina registrada, las simulaciones dependientes de ella quedan incompletas; el perfil persistido y las fórmulas permanecen intactos. Esto se aplica al texto, tarjetas y resultados estructurados de compra, margen, ahorro, espera y reserva.

## Precisión y generación de texto

Gemini recibe hechos y marcadores numéricos del resultado actual. Redacta el cuerpo usando esos marcadores y cita los hechos que utiliza. El servidor sustituye las cantidades; el modelo no puede incorporar importes, fechas o números nuevos. Se rechazan hechos desconocidos, omisiones obligatorias, confusión entre saldo y margen, cifras literales y preguntas repetidas. Las advertencias críticas se conservan textualmente; las paráfrasis duplicadas se eliminan antes de mostrarlas.

Ejemplos comprobados con el perfil sintético de la solicitud:

- $3,000 − $1,449 = **$1,551 de saldo contable hipotético**. No equivale a dinero libre ni recomienda la compra.
- $1,449 ÷ 4 = **$362.25 semanales como objetivo matemático**, partiendo de cero. La capacidad sostenible puede seguir desconocida.
- Al cambiar el precio del mismo juego a $900, el objetivo en cuatro semanas pasa a **$225 semanales**.
- $210 diarios × 14 días = **$2,940 de gastos esenciales aritméticos**. Sin ingresos/calendario suficientes no se presenta como saldo futuro proyectado.
- Un margen inmediato calculable se comunica aunque la proyección posterior esté incompleta; no se convierte en garantía futura.

Las fórmulas de `financialEngine`, `purchaseDecision`, `purchaseReport`, `weeklyProjection` y `goalImpact` no se modificaron. Las operaciones nuevas son aritmética explícita y selección de herramientas. Conversar no registra compras, gastos, XP ni modificaciones de metas.

## Ingresos: estado comprobable

No fue posible certificar las filas de la cuenta reportada. La consulta remota de metadatos volvió a responder **HTTP 401** con la configuración disponible. No se consultaron filas personales ni se hicieron escrituras remotas.

El código comprueba propietario e `is_active = true`, conserva ingresos con fecha vencida como fuentes y diferencia fechas desconocidas, calendarios múltiples y ausencia visible de fuentes. Cero filas activas visibles no demuestra pérdida de datos: también puede corresponder a actividad, propietario o RLS. No hay SQL versionado que permita certificar el RPC de onboarding o las políticas desplegadas. No se encontró un salario alternativo persistido en `profiles` que pudiera utilizarse con respaldo comprobado.

El historial sí demuestra una antigua inconsistencia `name`/`title` en el editor, corregida antes de este cambio. No demuestra que fallara una escritura concreta de esta cuenta. La [auditoría de ingresos](conversational-income-audit.md) documenta consultas, transformación, onboarding, filtros y límites de evidencia.

Cuando falta información pertinente, **Completar ingresos en mi perfil** abre el editor existente en la pestaña de ingresos. El enlace alternativo `/app#ingresos` también abre esa pestaña. La acción no aparece como una exigencia de registrar una nómina si el usuario declara que no tiene ingresos.

## Fallos y trazabilidad

Si falla la interpretación o la explicación, se conserva el cálculo determinista, el historial visible y un contexto firmado válido. La respuesta usa `source: deterministic`, aviso explícito y opción de reintentar con Gemini. Los errores 503 y 504 se prueban mediante dobles; no se provocaron fallos del proveedor real.

Los logs contienen solo etapa, resultado, código y operación: validación, autenticación, interpretación, consulta financiera, motor, explicación y respaldo. No incluyen mensajes, importes, identidad, tokens ni errores crudos del proveedor. Las comprobaciones de origen, identidad, duplicados y límites de solicitudes se mantienen.

## Verificación

Las pruebas cubren las conversaciones A–J de la solicitud, con comprobaciones de selección de herramienta, contexto firmado, confirmación distinta, precio actualizado, ahorro matemático, datos parciales, cuenta cambiada, fallos del proveedor y margen inmediato separado de la proyección futura.

La ejecución completa y las verificaciones finales se registran al cierre de este documento. Los tests de API y UI usan dobles aislados; no prueban las políticas RLS desplegadas ni sustituyen una sesión de navegador contra una cuenta real.

Se ejecutó además una conversación real limitada de **ocho turnos** con `gemini-3.5-flash-lite`: **8/8 aprobados**, interpretación y explicación del proveedor en cada turno, sin fallback. Usó únicamente el perfil sintético de saldo $3,000, reserva $650, gasto diario $210 e ingresos desconocidos. No leyó Supabase ni escribió datos. El [resultado completo](conversational-copilot-live-results.json) conserva las respuestas, intenciones, tarjetas y comprobaciones, no credenciales.

Para repetir esa prueba de forma explícita:

```bash
node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/test.cjs scripts/test-conversational-copilot.cjs --live
```

Sin `--live`, el script valida la secuencia sin contactar al proveedor. La puntuación de calidad representa cumplimiento del contrato de cifras/hechos; no certifica universalmente la calidad de cualquier consejo o conversación.

## Conversación real de ejemplo

Las siguientes respuestas proceden de la prueba con Gemini real y datos sintéticos. El producto se mantiene durante el cambio de tema y de precio.

**Usuario:** ¿Puedo comprar Metroid Ravenous por $1,449?

**Asistente:** No puedo determinar si la compra cabe en tu margen. No aparecen fuentes de ingreso activas y visibles ni una fecha de próximo pago confirmada.

El saldo contable hipotético tras la compra sería $1,551.00 MXN; no es dinero libre ni confirma la conveniencia de comprar.

¿Tus ingresos tienen una fecha fija o son variables?

**Usuario:** Sí, están actualizados

**Asistente:** Gracias por confirmarlo. Los datos están actualizados, aunque todavía pueden faltar campos necesarios.

No aparecen fuentes de ingreso activas y visibles ni una fecha de próximo pago confirmada.

**Usuario:** ¿Y si espero dos semanas?

**Asistente:** Los gastos esenciales registrados sumarían $2,940.00 MXN durante ese plazo. Es aritmética de gastos, no una proyección completa del saldo.

No puedo proyectar el saldo tras ese plazo sin un calendario de ingresos y pagos confirmado.

**Usuario:** ¿Y si el juego costara $900?

**Asistente:** No puedo determinar si la compra cabe en tu margen. No aparecen fuentes de ingreso activas y visibles ni una fecha de próximo pago confirmada.

El saldo contable hipotético tras la compra sería $2,100.00 MXN; no es dinero libre ni confirma la conveniencia de comprar.

**Usuario:** ¿Cuánto tendría que ahorrar para comprarlo en cuatro semanas?

**Asistente:** Para Metroid Ravenous en 4 semanas, necesitas un objetivo matemático de $225.00 MXN cada semana partiendo de $0.00 MXN para alcanzar $900.00 MXN.

Es un objetivo matemático; todavía no se ha comprobado que puedas apartarlo sin afectar tus gastos.

**Usuario:** ¿Qué debería priorizar este mes?

**Asistente:** Para este mes, protege primero tus necesidades esenciales y cualquier obligación próxima. Como no aparecen pagos activos registrados, te sugiero mantener esta estructura antes de realizar compras discrecionales.

**Usuario:** No tengo ingresos actualmente

**Asistente:** Entendido: registré que actualmente no tienes ingresos. Esta aclaración se mantiene en nuestra conversación sin modificar tus registros.

**Usuario:** Mis ingresos son variables

**Asistente:** Entendido, tus ingresos son variables. Respetaré esta condición en nuestro análisis financiero actual. No generaré ninguna frecuencia de cobro ficticia.

## Archivos modificados o añadidos

| Área | Archivos |
| --- | --- |
| API | `src/app/api/ai/chat/route.ts`, `src/app/api/evaluate/route.ts` |
| Estado, interpretación y explicación | `src/lib/ai/conversationState.ts`, `conversationalReply.ts`, `financialConversation.ts`, `financialAssistant.ts`, `prompts.ts`, `schemas.ts` |
| Aritmética y diagnóstico | `src/lib/finance/conversationalMath.ts`, `profileDiagnostics.ts` |
| Interfaz existente | `src/components/FinancialChat.tsx`, `ProfileEditorPanel.tsx`, `src/app/app/page.tsx` |
| Pruebas nuevas | `tests/conversation-turns-api.test.cjs`, `conversational-math.test.cjs`, `conversational-reply.test.cjs`, `financial-copilot-tools.test.cjs` |
| Regresiones adaptadas | `tests/financial-chat-api.test.cjs`, `financial-chat-ui.test.cjs`, `financial-query-regression.test.cjs` |
| Herramientas de prueba | `scripts/test-conversational-copilot.cjs`, `scripts/test-chat-browser.cjs` |
| Evidencia y entrega | Este documento, `docs/conversational-income-audit.md`, `docs/conversational-copilot-live-results.json` |

## Limitaciones pendientes

- La causa de los ingresos ausentes de la cuenta real requiere acceso autenticado válido para comprobar filas, esquema, RPC y RLS. HTTP 401 no permite escoger entre esas causas.
- La proyección existente cubre seis semanas. Plazos mayores se presentan como aritmética condicionada; no se prometen ingresos futuros.
- Declaraciones conversacionales no actualizan registros. Para confirmar un ingreso real se utiliza el editor existente. Su formulario no modela automáticamente todos los calendarios de ingresos variables.
- El historial es de sesión, acotado y con caducidad. Una clave rotada o un contexto caducado exige iniciar una conversación nueva.
- La prueba real es una muestra limitada de ocho turnos sintéticos. No se ejecutó de nuevo la prueba de navegador en este cambio; las interacciones y el aislamiento se verificaron con pruebas automatizadas de componentes y API.

## Resultados finales

| Comando / conjunto | Resultado |
| --- | --- |
| `npm test` | Aprobado: 184 subpruebas Node, 79 verificaciones financieras personalizadas y 10/10 escenarios de Sebas; también pasa el conjunto de mapper/acceso. 29 archivos ejecutados. |
| `npx tsc --noEmit` | Aprobado. |
| `npm run lint` | Aprobado: cero errores y 18 advertencias existentes. |
| `npm run build` | Aprobado: compilación, TypeScript y generación de las 15 páginas/rutas. |
| Conversación con Gemini real | 8/8 turnos aprobados con datos sintéticos; todas las respuestas con `source: gemini`, sin fallback. |
| `git diff --check` | Aprobado. |

Los escenarios A–J se cubren con mocks y herramientas deterministas. La muestra real abarca A, confirmación, espera, E, D con el precio actualizado, C, F y G; B, H, I y J se verificaron de manera aislada, sin atribuir esos resultados al modelo real. Las regresiones adicionales comprueban nómina contradicha, preguntas hipotéticas que no cambian ingresos y ausencia de bucles de seguimiento.
