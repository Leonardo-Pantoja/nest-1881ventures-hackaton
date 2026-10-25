# Copiloto financiero conversacional — entrega

Implementado en el repositorio existente. La sección «¿Qué estás pensando comprar?» del dashboard incorpora la conversación y conserva el simulador, la planta, la evaluación completa, Wishlist y metas. El chat es de solo lectura.

## A. Archivos creados y modificados

Rutas relativas a la raíz del repositorio. No se modificaron las reglas ni las expectativas numéricas del motor de Sebas.

| Estado | Archivo | Cambio |
| --- | --- | --- |
| Creado | `src/app/api/ai/chat/route.ts` | Endpoint conversacional autenticado, sin caché, con alternativa determinista. |
| Creado | `src/components/FinancialChat.tsx` | Chat compartido, imágenes, contexto, errores, reintento y evaluación manual sin IA. |
| Creado | `src/lib/ai/schemas.ts` | Contratos Zod de solicitud, operación, explicación y respuesta. |
| Creado | `src/lib/ai/prompts.ts` | Reglas separadas de interpretación y explicación. |
| Creado | `src/lib/ai/financialAssistant.ts` | Orquestación, argumentos anclados a importes del usuario y reducción de datos enviados. |
| Creado | `src/lib/ai/financialTools.ts` | Operaciones financieras permitidas y biblioteca de afirmaciones verificadas. |
| Creado | `src/lib/ai/chatAccess.ts` | Autenticación, tamaño del cuerpo, presupuestos y exclusión de duplicados. |
| Creado | `src/lib/ai/responseEvaluation.ts` | Rúbrica reproducible de cinco dimensiones y rechazo de inconsistencias. |
| Creado | `src/lib/ai/scenarios.ts` | Diez escenarios de Sebas y ocho ejemplos conversacionales sintéticos. |
| Creado | `src/lib/finance/savingsPlan.ts` | Capacidad de ahorro, aportaciones comprometidas, plazos y fechas condicionadas. |
| Creado | `src/lib/finance/waitScenario.ts` | Escenario al siguiente ingreso con calendario compatible. |
| Creado | `tests/financial-chat-api.test.cjs` | Orquestación, autenticación, privacidad, errores, cuotas, cancelación y consistencia. |
| Creado | `tests/financial-chat-tools.test.cjs` | Cifras de los diez casos, ahorro, comparación, espera, prioridades, metas y riesgos. |
| Creado | `tests/financial-chat-ui.test.cjs` | Eventos React, historial, Enter/Shift+Enter, duplicados, cuentas y respuestas tardías. |
| Creado | `tests/financial-chat-snapshot.test.cjs` | Consultas del propietario autenticado, tablas activas y fallos sin filtración de logs. |
| Creado | `scripts/test-financial-chat.cjs` | Evaluación optativa que llama realmente a Gemini con datos sintéticos. |
| Creado | `scripts/test-chat-browser.cjs` | Prueba de humo en Chrome aislado mediante CDP, sin dependencias nuevas. |
| Creado | `scripts/inspect-financial-schema.cjs` | Consulta de metadatos PostgREST sin leer registros. |
| Creado | `docs/financial-chat-live-results.json` | Resultados de las diez pruebas reales con Gemini. |
| Creado | `docs/financial-chat-conversation-live-results.json` | Resultados reales de interpretación y explicación de A–H. |
| Creado | `docs/financial-chat-browser-results.json` | Evidencia de la prueba de humo en navegador. |
| Creado | `docs/financial-chat-integration.md` | Esta entrega, arquitectura, resultados y límites. |
| Modificado | `package.json` | Comando optativo `test:chat:live`; dependencias sin cambios. |
| Modificado | `next.config.ts` | Opción local `ADG_TURBOPACK_WORKERS=1` para hosts que bloquean sockets de loaders. |
| Modificado | `README.md` | Enlace a esta entrega. |
| Modificado | `src/app/api/evaluate/route.ts` | Conserva la evaluación determinista; retira el antiguo chat, reconocimiento duplicado y ahorros arbitrarios. |
| Modificado | `src/app/app/page.tsx` | Integra el chat, retira Escanear del apartado principal y refleja riesgos en mensajes existentes. |
| Modificado | `src/app/app/evaluate/page.tsx` | Conserva el flujo completo, confirma imágenes y mantiene el producto actualizado sin borrar cada seguimiento. |
| Modificado | `src/components/PurchaseEvaluationFlow.tsx` | Reutiliza el chat; calcular ahorro prepara una pregunta explícita, sin guardar un plan arbitrario. |
| Modificado | `src/components/QuickSnapScanner.tsx` | Modo adjunto y confirmación del análisis; conserva reconocimiento, corrección y compatibilidad anterior. |
| Modificado | `src/components/PrePurchaseCopilot.tsx` | El prototipo sin referencias que tenía otro motor y ahorros hardcodeados ahora exporta el chat compartido. |
| Modificado | `src/context/FinancialContext.tsx` | Limpia inmediatamente los datos anteriores cuando cambia la identidad autenticada. |
| Modificado | `src/lib/ai/gemini.ts` | Comparte transporte SDK, timeout, un reintento transitorio y validación estructurada. |
| Modificado | `src/lib/finance/accountSnapshot.ts` | Conserva adaptador y consultas; elimina detalles de errores de los logs. |
| Modificado | `src/lib/finance/evaluation.ts` | Los widgets advierten riesgos futuros o proyecciones incompletas, manteniendo los importes del motor. |
| Modificado | `src/lib/finance/money.ts` | Formato MXN compartido sin importar servicios del servidor desde el cliente. |
| Modificado | `src/lib/geminiCases.test.ts` | Corrige imports hacia `onboarding/`; expectativas intactas. |
| Modificado | `src/lib/purchasePrecision.test.ts` | Corrige imports hacia `onboarding/`; expectativas intactas. |
| Modificado | `tests/scanner-confirmation.test.cjs` | Actualiza la antigua comprobación estructural del input del dashboard; conserva la prueba de envío explícito. |
| Modificado | `src/components/ExpensePlanView.tsx` | Escape de comillas JSX para corregir un error previo de lint. |
| Modificado | `src/components/GoalsAndCoolingView.tsx` | Bucle equivalente para corregir un error previo de lint de React, sin cambiar cálculos. |

`FinancialPlantWidget.tsx` y los mecanismos de persistencia existentes se reutilizan sin modificaciones.

## B. Integración del motor de Sebas

La fuente de verdad es `src/lib/onboarding/`. Las rutas antiguas bajo `src/lib/` de los documentos de entrega ya no corresponden a la ubicación real. Las cuatro importaciones rotas impedían inicialmente ejecutar la suite y TypeScript; se corrigieron sus rutas, sin cambiar resultados esperados.

- `calculateSafeToSpend()` calcula el margen inmediato y las reservas, compromisos y pagos de deuda considerados.
- `buildPurchaseReport()` integra la evaluación de compra, escenarios anterior/posterior y estados `calculado`, `datos_incompletos` y `saldo_insuficiente`. Reutiliza internamente `evaluatePurchase()` y `projectSixWeeks()`.
- `projectSixWeeks()` también comprueba la liquidez de los escenarios de ahorro. No se implementó otro proyector diario.
- `calculateGoalImpact()` se usa para retiros explícitos simulados. El reporte existente también devuelve información de una retirada de cero; el chat no interpreta ese cero como una garantía sobre la fecha de una meta.
- `mapSupabaseRecord()` sigue siendo el adaptador único hacia `OnboardingProfile`. Considera todas las metas y separa pagos de deuda para evitar duplicarlos.

Los diez escenarios coinciden con `docs/gemini-test-cases.md`, incluidos el límite exacto de reserva, la semana seis en riesgo para una compra de $700 y el margen inmediato conocido cuando falta el calendario mensual. No se modificaron esas cifras.

El adaptador actual no puede representar varios calendarios de ingreso simultáneos. Si hay varias fuentes activas devuelve ingresos/fechas desconocidos, en lugar de usar solamente la primera o sumarlas como si fueran una nómina. Este límite se conserva y se explica al usuario.

## C. Arquitectura Gemini y privacidad

`POST /api/ai/chat` implementa esta secuencia:

1. Comprueba origen, tipo de contenido, cuerpo de hasta 32 KiB y esquema estricto. Mensaje de hasta 1,500 caracteres y hasta diez turnos anteriores del usuario.
2. Verifica la sesión mediante Supabase Auth. No acepta `user_id`, saldos, reportes ni perfiles financieros del navegador.
3. Gemini devuelve una operación permitida y parámetros mediante JSON Schema, validados con Zod. No se ejecuta código generado.
4. Los importes deben existir en lo escrito por el usuario o en el producto confirmado. Un retiro de meta y un apartado inicial requieren además una indicación explícita.
5. Se carga una nueva instantánea autorizada de `profiles`, `income_sources`, `commitments` y `goals`, con filtros de propietario y actividad. La identidad se comprueba otra vez para detectar cambios de sesión.
6. El backend ejecuta la operación determinista: compra, margen, ahorro, comparación, espera, prioridades, meta, reserva o retiro explícito simulado.
7. Se construye una biblioteca de afirmaciones exactas a partir de los resultados. Solo los hechos necesarios de esa operación llegan a Gemini; no se envían tablas, perfil completo, nombre personal, correo, IDs de cuenta, tokens ni claves. Las descripciones de compromisos se anonimizaron para esta fase.
8. Gemini organiza la explicación seleccionando identificadores de hechos y una pregunta de seguimiento permitida. El servidor exige todos los diagnósticos y advertencias obligatorios y rechaza identificadores desconocidos, duplicados, texto libre adicional u omisiones de riesgos.
9. El servidor renderiza los párrafos desde las afirmaciones autorizadas. Las tarjetas también proceden exclusivamente del backend.

Este mecanismo equivalente de orquestación usa [salidas estructuradas del SDK oficial de Gemini](https://ai.google.dev/gemini-api/docs/structured-output). La explicación está deliberadamente restringida: Gemini interpreta la pregunta y organiza frases financieras verificadas; no redacta cantidades ni afirmaciones financieras libres. La rúbrica automática evalúa este contrato estructurado, no una auditoría humana de respuestas libres arbitrarias.

El chat no tiene herramientas para escribir datos. No registra compras, saldo, XP, rachas, metas ni aportaciones. El historial permanece en estado de React y se limpia al cambiar de cuenta o de versión financiera. No se añadieron tablas ni migraciones.

El endpoint tiene exclusión de consultas simultáneas por identidad, identificadores únicos con protección de repetición y presupuestos de seis consultas IA por minuto, cuarenta por hora y cien por hora globales. La consulta sin IA tiene un presupuesto separado de veinte por minuto. Estas protecciones son por proceso; varias réplicas necesitarían un coordinador compartido para imponer un límite global de despliegue.

Las dos fases de Gemini comparten un plazo de 50 segundos. El transporte conserva el timeout de reconocimiento de 55 segundos y como máximo un reintento con espera en 503/504, incluyendo el fallback de modelo configurado. No reintenta automáticamente cuotas, errores de credenciales, JSON inválido ni inconsistencias. El cliente cancela o descarta solicitudes obsoletas y ofrece reintento explícito y evaluación sin IA. Los logs nuevos contienen solo metadatos operativos.

## D. Chat del dashboard y componentes existentes

Se retiraron el botón independiente Escanear y la antigua barra de búsqueda por IA de la sección principal. El campo actual es un `textarea` con botón Enviar; las sugerencias solo preparan el borrador. No hay debounce ni efectos que envíen texto.

- Clic en Enviar o Enter sin Shift envía una consulta; Shift+Enter conserva la edición multilínea. Un bloqueo síncrono impide doble envío.
- El historial muestra usuario/asistente, cálculo sin IA o explicación organizada por Gemini, carga, errores y reintentos.
- Imagen abre el componente de reconocimiento existente. JPG/PNG/WebP, máximo 8 MiB; permite previsualizar y eliminar antes de pulsar Analizar imagen. Se usa `/api/ai/recognize-product`.
- El reconocimiento muestra nombre, precio y moneda; se pueden corregir. Solo Confirmar y evaluar incorpora ese producto al chat. No convierte precios extranjeros silenciosamente.
- Elegir otro producto o adjuntar otra imagen aborta/descarta respuestas anteriores. Los cambios de cuenta y datos financieros invalidan la conversación anterior.
- Ver evaluación completa abre el `PurchaseEvaluationFlow` existente y mantiene su planta y acciones. El mismo chat se reutiliza en esa pantalla.
- Evaluar un precio sin IA permite confirmar nombre y precio manualmente, conservando centavos y sin consumir Gemini.

Se conservaron los colores, tarjetas, bordes, radios, tipografía, iconos y animaciones existentes. Los avisos del simulador y de la planta usan ahora el riesgo/proyección de su reporte, para que una compra con riesgo futuro no aparezca únicamente como favorable.

## E. Planes de ahorro

Todos los cálculos nuevos trabajan en centavos enteros. No se usan aportaciones semanales fijas inventadas.

1. El apartado inicial es cero salvo indicación explícita. Debe caber en el margen registrado y no superar el objetivo.
2. Las aportaciones semanales ya comprometidas a todas las metas se representan como transferencias protegidas en una copia del perfil. Esta capa adicional no cambia el reporte base de Sebas, que documenta su exclusión de aportaciones futuras.
3. La capacidad recurrente tiene como techo el ingreso semanal equivalente menos gastos esenciales, pagos recurrentes y aportaciones comprometidas. Se redondean conservadoramente las fracciones de quincena.
4. Una búsqueda en centavos comprueba esa capacidad con `calculateSafeToSpend()` y `projectSixWeeks()`, incluyendo pagos únicos, reserva y ahorros protegidos. Un excedente recurrente positivo no basta si existe un problema de liquidez en el calendario.
5. Para un plazo dado, la aportación requerida es `ceil(objetivo_restante_en_centavos / semanas)`. Para una aportación dada, el plazo es `ceil(objetivo_restante_en_centavos / aportación_en_centavos)`.
6. Se comprueba que la aportación cabe en la capacidad y que cumple el plazo solicitado. De lo contrario el escenario se marca `no_sostenible`, sin recomendarlo como viable.
7. Una fecha estimada requiere calendario conocido y aportaciones semanales desde la fecha financiera. Pasadas seis semanas se etiqueta como estimación aritmética condicionada a aportaciones constantes, no como proyección financiera completa.

Si faltan datos de aportaciones, ingresos, fondos protegidos o un calendario compatible, solicita información en lugar de proponer una cantidad. El escenario de esperar utiliza gastos/pagos calculados por el motor hasta el siguiente ingreso; solo avanza calendarios fijos semanales/quincenales y pagos únicos conocidos.

Guardar planes desde el chat no forma parte de esta fase: el chat simula y remite a las vistas existentes. Los botones de calcular ahorro preparan la consulta; no guardan automáticamente un supuesto plan ni conceden XP. No se conectó ninguna escritura nueva que necesitara un flujo de confirmación o una migración.

## F. Validación ejecutada

| Verificación | Resultado real |
| --- | --- |
| `npm test` | 21 archivos; 85 subtests de Node aprobados, cero fallos; además pasan las verificaciones originales del motor/adaptador. |
| Motor financiero original + precisión | 79 verificaciones funcionales aprobadas: 12 + 8 + 15 + 23 + 15 + 6. |
| `src/lib/geminiCases.test.ts` | 10/10 escenarios de Sebas; expectativas numéricas sin cambios. |
| Nuevas pruebas del chat con dobles/mocks | 38 subtests: 20 herramientas, 8 API, 7 UI y 3 instantánea autorizada. |
| Conversación A–H | Cálculos deterministas y pruebas reales de interpretación/explicación con Gemini. |
| Conversación I–J | Pruebas de cambio de identidad/producto, aborto y descarte de respuestas tardías con hooks aislados. |
| `npx tsc --noEmit` | Aprobado con TypeScript estricto. |
| `npm run lint` | Sin errores; 18 advertencias de imports/variables e imágenes existentes. |
| `npm run build` | Falló por `binding to a port / Operation not permitted` del proceso de CSS de Turbopack; también se intentó fuera del sandbox. |
| `ADG_TURBOPACK_WORKERS=1 npm run build` | Build de producción aprobado: compilación, TypeScript, generación de 15 páginas y endpoint dinámico `/api/ai/chat`. Usa la opción documentada `turbopackPluginRuntimeStrategy: workerThreads`, optativa y sin cambiar el comportamiento predeterminado. |
| Gemini real, diez casos de Sebas | 10/10 aprobados, 10/10 puntos por respuesta estructurada; modelo configurado `gemini-3.5-flash-lite`. |
| Gemini real, ejemplos A–H | 8/8 aprobados, 10/10 puntos; el caso C verifica realmente precio referido de $900 y aportación de $225 por cuatro semanas. |
| Chrome aislado, perfil demo | Edición y Shift+Enter: cero consultas; un envío manual determinista y un seguimiento real de Gemini; historial conservado; sin excepciones de ejecución. |
| Chrome a 390 px | Sin desbordamiento horizontal. Capturas temporales indicadas en el reporte de navegador. |
| Consulta real de metadatos Supabase | HTTP 401; no fue posible certificar el esquema ni las políticas RLS desplegadas. |

La primera corrida real de los casos de Sebas aprobó nueve y recibió cuota 429 en el décimo. Se reintentó únicamente el pendiente con `--resume`, después del límite temporal. No se ocultó un fallback determinista como si fuera una respuesta real. Los JSON adjuntos contienen los resultados de llamadas reales con perfiles sintéticos, sin consultar ni enviar cuentas personales.

Las pruebas aisladas de UI no son E2E. La prueba adicional de Chrome sí abrió el dashboard real y recorrió entrada, evaluación manual, seguimiento Gemini y viewport móvil. El escenario H real verifica el contexto después de confirmar una imagen; no representa una nueva validación visual de Gemini con una fotografía real. Las pruebas de reconocimiento existentes siguen pasando con sus mocks.

### Reproducir

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
# Para el host restringido utilizado en esta entrega:
ADG_TURBOPACK_WORKERS=1 npm run build

# Optativas; consumen la cuota configurada de Gemini y solo usan perfiles sintéticos:
npm run test:chat:live
npm run test:chat:live -- --resume
npm run test:chat:live -- --conversation
npm run test:chat:live -- --conversation --resume

# Solo metadatos, sin registros:
node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/inspect-financial-schema.cjs
```

La prueba `scripts/test-chat-browser.cjs` requiere Chrome aislado escuchando CDP en 9227 y la aplicación local en `http://localhost:3000` (o `ADG_APP_ORIGIN`). Se ejecuta con `node --env-file-if-exists=.env scripts/test.cjs scripts/test-chat-browser.cjs`. No utiliza el perfil personal de Chrome. Los tests reales requieren conectividad, `GEMINI_API_KEY` y `GEMINI_MODEL`; no forman parte de `npm test`.

## G. Límites y comprobaciones pendientes

- No se garantizan ingresos ni solvencia. El margen inmediato cubre exclusivamente lo registrado.
- Varios calendarios de ingresos o ingresos variables no se extrapolan; requieren ampliar el contrato del motor.
- Los calendarios mensuales repetidos siguen incompletos. Los planes sostenibles no estiman un excedente mensual con una división arbitraria.
- El motor base no incluye aportaciones futuras a metas; la capa de ahorro/espera sí las protege explícitamente. Las compras corrientes no retiran ahorros automáticamente.
- Más allá de seis semanas hay estimación condicionada, no una proyección completa.
- Los perfiles públicos Mateo/Carlos usan su configuración inicial del servidor, aunque el sandbox local del frontend haya sido editado; el chat lo indica. Sus compromisos mensuales pueden impedir una proyección/plan completo. No se aceptan saldos demo arbitrarios del navegador.
- No hay persistencia permanente de conversaciones ni guardado de planes desde el chat. Las vistas y acciones existentes de metas/Wishlist siguen disponibles.
- Los presupuestos y la protección de solicitudes son locales al proceso; para varias réplicas se necesita almacenamiento/coordinación compartida.
- No hay esquema SQL ni políticas RLS versionadas en este repositorio que permitan auditarlas offline. La verificación remota de metadatos devolvió 401. Los filtros, Auth y ausencia de accesos cruzados están probados con mocks, pero eso no certifica las políticas desplegadas.
- Falta una prueba con sesión Supabase real de una cuenta del proyecto que confirme lectura autorizada, aislamiento RLS y los campos existentes. No se modificaron datos de producción ni credenciales.

## H. Veredicto de demostración

El copiloto está implementado y funciona en el dashboard: hay evidencia real de Gemini, del navegador y de las pruebas deterministas. Es demostrable con datos sintéticos y explica correctamente los límites del motor.

No se certifica todavía una demostración completa con datos de una cuenta real: el bloqueo pendiente es verificar acceso/esquema/RLS de Supabase con una sesión válida. Para demostrar un plan sostenible completo también se requiere un perfil con ingreso fijo y calendario compatible; los presets mensuales deben mostrar honestamente la limitación correspondiente. En este host, la compilación requiere el modo optativo de loaders en hilos documentado arriba.
