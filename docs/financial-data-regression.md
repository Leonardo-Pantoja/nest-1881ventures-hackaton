# Diagnóstico de la regresión de datos financieros

Este documento registra la evidencia encontrada al comenzar la corrección, con `HEAD` en `5e6e3c7`. Describe el código de esa versión y su historial; las correcciones posteriores pueden mover las líneas citadas. La auditoría no leyó cuentas personales ni modificó Supabase. Los resultados finales de pruebas deben añadirse después de ejecutarlas sobre la corrección integrada.

## Causas comprobadas

### La ruta de evaluación combina dos versiones incompatibles

El commit `811305c` incorporó en `/api/evaluate` una rama que asignaba `"Producto consultado"` y un precio de $500 cuando faltaban datos para una pregunta conversacional. En esa versión las variables eran mutables. También añadió `buildContextChatReply()`, que construía respuestas usando cifras recibidas desde el navegador y asumía importes, fechas o aportaciones cuando faltaban datos.

`6fc9b3c` retiró esos bloques de la ruta, dejó las consultas financieras en el servidor y declaró `itemName` e `itemPrice` con `const`. Ese commit incorporó el endpoint conversacional separado `/api/ai/chat` y su orquestación con el motor de Sebas.

El merge `5e6e3c7` tiene como padres `6fc9b3c` y `83a5153`. Su resultado reintrodujo bloques de la otra rama, incluyendo las reasignaciones sobre las variables `const`, el fallback de $500 y las referencias a `userQuestion`, `geminiKey`, `hasImage` y `chatMessages`, cuyas declaraciones no se conservaron. Esta mezcla explica tanto el error de reasignación como otros errores de TypeScript del archivo. La solución requiere reconciliar el flujo; cambiar únicamente `const` por `let` dejaría el precio inventado y las respuestas basadas en cifras del cliente.

Comprobación reproducible, sin modificar Git:

```bash
git show 811305c -- src/app/api/evaluate/route.ts
git show 6fc9b3c:src/app/api/evaluate/route.ts
git show 5e6e3c7:src/app/api/evaluate/route.ts
git show --no-patch --format=raw 5e6e3c7
```

### Los valores conocidos se ocultan cuando falta otro dato

En la versión auditada, `FinancialPlantWidget.tsx` calculaba `evaluationComplete` y sustituía todo `consideredExpenses` por `null` cuando esa condición era falsa. El dashboard tenía un filtro equivalente, basado en `evaluationReady`. De esa forma, una fecha de ingreso desconocida también ocultaba un saldo registrado.

El motor no elimina esos valores: la respuesta incompleta de `calculateSafeToSpend()` conserva `currentBalance` y `safetyBuffer`, y `buildDeterministicEvaluation()` los incluye en `consideredExpenses`. Por tanto, hay un defecto de presentación demostrable. No constituye evidencia de que Supabase haya borrado registros.

El mapper estricto y esos filtros visuales se introdujeron en `bb2e694`. En su padre, la planta mostraba `profile.currentBalance` directamente y calculaba un margen local. La visibilidad anterior de un número no demuestra que ya estuviera validado con todas las reglas del motor.

```bash
git log --oneline -S 'const evaluationComplete' -- src/components/FinancialPlantWidget.tsx
git log --oneline -S 'const expenses = evaluationReady' -- src/app/app/page.tsx
git show bb2e694^:src/components/FinancialPlantWidget.tsx
```

### Existen diferencias entre el mapper financiero y la representación del contexto

En `5e6e3c7`, `nextDateFromSources()` devolvía todos los datos del siguiente ingreso como desconocidos cuando el número de fuentes no era exactamente uno. Una fecha pasada también producía `null`. Esos casos pueden impedir el cálculo del margen o la proyección, incluso si el importe de una fuente sí está registrado. No es correcto recuperar el cálculo eligiendo arbitrariamente la primera fuente, inventando una nueva fecha o reemplazando desconocidos con cero.

En paralelo, `FinancialContext.tsx` seleccionaba el primer ingreso de la consulta, convertía valores ausentes con `Number(... ?? 0)` y `daysUntil()` devolvía cero para fechas desconocidas. Así podían coexistir un perfil visual aparentemente completo y un perfil canónico incompleto usado por las APIs.

También hay una diferencia en ahorros: al cargar metas, el contexto asumía `savingsLocation = "separado"` cuando no estaba registrada la ubicación y había ahorro. El mapper conservaba `"desconocido"`. El motor rechaza correctamente estimar dinero libre si un ahorro positivo podría estar incluido o separado y no se confirmó cuál de las dos situaciones corresponde.

Las reglas de Sebas deben conservarse. La corrección consiste en preservar y presentar cada dato conocido, identificar las condiciones que realmente bloquean el cálculo y mantener los desconocidos como desconocidos.

### La escritura de ingresos tiene nombres de columna inconsistentes

El commit `bb0ddde`, cuyo mensaje indica alineación con las columnas de Supabase, cambió el campo de la actualización de `income_sources` de `name` a `title`. En la versión auditada la inserción de una fuente nueva continuaba enviando `name`. La lectura aceptaba `inc.name ?? inc.title`.

Evidencia en `FinancialContext.tsx` de `5e6e3c7`:

- `upsertIncomeSource()`, rama de actualización: `title: cleanName`.
- La misma función, rama de inserción: `name: cleanName`.
- La construcción de `IncomeSourceRecord`: campo de interfaz `name`, leído desde `inc.name ?? inc.title`.
- El perfil demo y `ProfileEditorPanel` usan el campo de interfaz `name`; eso no prueba que exista una columna SQL `name`.

El parche mínimo coherente con el cambio de esquema más reciente es usar `title` en ambas escrituras y preferir `inc.title` en la lectura, manteniendo `inc.name` únicamente como compatibilidad de lectura cuando realmente venga en un registro. No requiere renombrar el campo `name` de los componentes ni actualizar filas existentes. Debe probarse el payload de inserción y actualización, sin afirmar que esta auditoría haya certificado remotamente una columna SQL.

```bash
git show bb0ddde -- src/context/FinancialContext.tsx
git show 5e6e3c7:src/context/FinancialContext.tsx
```

### Un demo guardado puede anteceder a la comprobación de la sesión

La inicialización del contexto restauraba `antesdegastar_demo_profile_v2` antes de consultar Auth. Esa prioridad puede mostrar un demo guardado al recargar una sesión autenticada. Es un comportamiento del cliente comprobable; no demuestra que haya ocurrido en la cuenta concreta reportada. La corrección debe comprobar la identidad y distinguir una selección demo explícita de un residuo de sesión, conservando el aislamiento entre cuentas.

## Tablas y columnas respaldadas por el código

La tabla siguiente describe los nombres que el repositorio consulta, transforma o escribe. **No es un esquema SQL auditado.** No hay migraciones, definiciones de tablas, políticas RLS ni el cuerpo de los RPC versionados en el árbol o historial inspeccionados. Un `select("*")` tampoco prueba por sí solo la existencia de cada campo opcional que después intenta leer JavaScript.

| Tabla o mecanismo | Campos respaldados por consultas/escrituras del código | Evidencia y alcance |
| --- | --- | --- |
| `profiles` | `id`, `display_name`, `current_balance`, `safety_buffer`, `daily_essential_budget`, `lifestyle_tags`, `onboarding_completed_at` | `accountSnapshot.ts` y `FinancialContext.tsx` cargan el perfil; `mapSupabaseRecord()` convierte los campos financieros; el editor escribe los campos base. El indicador de onboarding se lee del registro. |
| `profiles` | `dependents_count`, `wisdom_xp`, `streak_count` | El contexto los utiliza en perfil/gamificación. `bb0ddde` movió `dependents_count` al payload principal del editor. No se propone cambiarlos para recuperar el margen. |
| `income_sources` | `id`, `user_id`, `title`, `amount`, `frequency`, `next_payment_date`, `is_active` | Consultas del propietario con filtro de actividad; actualización con `title` tras `bb0ddde`. La inserción aún usaba `name` en el HEAD auditado. `name` también es una propiedad del modelo visual y una compatibilidad de lectura. |
| `commitments` | `id`, `user_id`, `title`, `amount`, `category`, `frequency`, `next_due_date`, `is_active` | Consultas del propietario y operaciones de crear/editar compromisos del contexto. El mapper usa fechas y frecuencias; no debe inferir calendarios ausentes. |
| `commitments`, campos opcionales del mapper | `kind`, `is_confirmed`, `total_balance`, `dueInDays` | Son campos o aliases que el mapper intenta interpretar si existen. Esta auditoría no demuestra que sean columnas del esquema desplegado. La deuda también puede identificarse por `category`, y `amount` representa su pago registrado. |
| `goals` | `id`, `user_id`, `title`, `target_amount`, `current_saved`, `weekly_contribution`, `savings_location`, `target_date`, `is_active`, `created_at` | `saveGoalWithSubGoals()` escribe importes y ubicación en creación/edición; la carga ordena por `created_at`; el mapper conserva ubicación desconocida. `bb0ddde` añadió además la escritura explícita de ahorro/aportación/ubicación en `contributeToGoal()`. |
| `goals`, lectura opcional | `category` | El mapper acepta la categoría si viene; en su ausencia clasifica por el título. No se certifica una columna SQL solo por esa lectura opcional. |
| `transactions` | `user_id`, `type`, `amount`, `category`, `description`, `occurred_at` | `bb0ddde` cambió escrituras que usaban `title` a `description` y añadió `occurred_at`. Es evidencia de alineación pretendida en el código, no de auditoría remota. No es la fuente de saldo utilizada por el motor. |
| RPC `complete_financial_onboarding` | `p_display_name`, `p_lifestyle_tags`, `p_current_balance`, `p_safety_buffer`, `p_daily_essential_budget`, `p_pay_frequency`, `p_next_payday_days`, `p_next_payday_amount`, `p_commitments`, `p_goal_title`, `p_goal_target_amount` | `saveOnboarding.ts` envía estos parámetros después de verificar Auth. Sin el cuerpo SQL no puede demostrarse cómo se traducen a filas, fechas, frecuencias, actividad o ubicación de ahorros. |

La evidencia específica de `goals.savings_location` es más amplia que una lectura opcional: `saveGoalWithSubGoals()` la envía tanto en `insert` como en `update`, y `bb0ddde` la incluyó también en el nuevo `contributeToGoal()`. Sus valores permitidos en el contrato del motor son `incluido`, `separado` y `desconocido`. Esa evidencia respalda conservar el campo y corregir la suposición del contexto; no autoriza completar ubicaciones desconocidas de registros existentes.

## Flujo de persistencia y lectura comprobado

El onboarding autenticado llama primero a `saveOnboardingToSupabase()` y solo después a `completeOnboarding(..., userId)`. Esta función limpia el demo e inicia una recarga del perfil desde Supabase. No se encontró una eliminación directa de perfiles, ingresos, compromisos o metas en ese flujo.

`loadAccountSnapshot()` obtiene el usuario con `auth.getUser()`, filtra `profiles.id` y las colecciones por `user_id`/`is_active`, rechaza errores de consulta y pasa los registros a `mapSupabaseRecord()`. Las APIs deben reutilizar esa instantánea autorizada, sin sustituirla por cifras del navegador cuando falte la sesión o un dato.

El flujo de referencia es:

```text
Supabase Auth
  → consultas del propietario
  → mapSupabaseRecord()
  → OnboardingProfile con datos conocidos y desconocidos diferenciados
  → calculateSafeToSpend() / buildPurchaseReport() / projectSixWeeks()
  → API con estado y datos calculados
  → explicación Gemini validada y presentación del frontend
```

El saldo conocido puede mostrarse aunque la fecha del siguiente ingreso sea desconocida. Un margen inmediato calculado debe distinguirse de una proyección de seis semanas incompleta. Ninguna de las dos situaciones permite inventar un precio de compra.

## Qué requiere todavía acceso autorizado a Supabase

- Comprobar las filas de una cuenta real y distinguir datos ausentes, registros inactivos y errores de consulta.
- Confirmar las columnas y restricciones desplegadas, especialmente `income_sources.title` y los campos de actividad/fechas.
- Inspeccionar el cuerpo y los permisos de `complete_financial_onboarding`: qué filas crea, si conserva importes y cómo determina `next_payment_date`, `frequency`, `is_active` y las propiedades de las metas.
- Auditar las políticas RLS de las cuatro tablas financieras y verificar aislamiento con sesiones de cuentas distintas.
- Realizar una lectura posterior al onboarding y una recarga de página con sesión real, verificando que los mismos registros lleguen al mapper y ambas APIs.

La entrega anterior registra una consulta de metadatos con HTTP 401. Esta auditoría no repitió esa consulta ni convirtió ese resultado histórico en una verificación de las credenciales actuales. Los tests con mocks pueden comprobar filtros, contratos y presentación; no prueban la existencia de filas reales ni certifican RLS desplegado.

No se propone borrar registros, completar datos desconocidos con defaults, ejecutar migraciones ni revertir commits completos. Las correcciones deben aplicarse a los bloques responsables, conservando el motor de Sebas y las funcionalidades existentes.

## Correcciones aplicadas

- `/api/evaluate` quedó como evaluación/resumen autorizado con compatibilidad validada para preguntas. Los campos del producto son inmutables y no se reasignan; se retiró el chat legado mezclado y su fallback de precio de $500.
- Las preguntas generales llaman al cálculo de margen sin construir una compra. Las preguntas sobre un artículo sin precio solicitan ese dato. Un nombre genérico como «Producto consultado» no identifica un artículo.
- El contexto de producto solo hereda precios si corresponden al mismo artículo. El artículo explícito de la pregunta prevalece sobre un nombre incorrecto devuelto por Gemini. La UI limpia el precio anterior y conserva el nombre pendiente; la pantalla de evaluación tampoco vuelve a tomar un precio antiguo del URL o de la sesión después de limpiarlo.
- `PurchaseEvaluationFlow` reutiliza `FinancialChat` en el contenedor ancho existente. Se retiraron los bloques de merge que enviaban saldos del navegador, calculaban respuestas locales incompletas y referenciaban estados inexistentes. Se conservan controles, imágenes, tarjetas y estilos.
- El mapper conserva todas las fuentes como metadatos sin PII. Usa la próxima fecha confirmada más cercana y suma en centavos únicamente los importes de esa fecha. Solo trata varias fuentes como una nómina repetida si sus fechas y frecuencias coinciden. Las demás conservan proyección incompleta.
- Un salario individual sigue registrado aunque falte o haya vencido su fecha. Una fecha de ingreso vencida no acredita dinero ni se avanza automáticamente. Si una fecha es desconocida entre varias fuentes, no se afirma saber cuál será la próxima. Los pagos únicos vencidos se mantienen exigibles hoy; las recurrencias vencidas requieren confirmar su calendario.
- Los códigos de diagnóstico distinguen ausencia de fuentes, importe desconocido, fecha faltante, vencida o inválida, frecuencia desconocida, ahorro de ubicación desconocida y obligaciones incompletas. Se muestran los campos conocidos independientemente de si puede calcularse el margen.
- La API devuelve `registeredData` y límites de proyección; el dashboard y la planta conservan saldo y reservas conocidos. El bloque existente distingue carga, error, datos registrados, margen incompleto y proyección incompleta. Un resumen sin compra no muestra «Compra viable hoy» y también advierte riesgos de su proyección base.
- La carga inicial verifica Auth antes de restaurar un demo guardado. La recarga y actualización después del onboarding usan los registros del servidor. Los cambios de cuenta invalidan el perfil y la conversación anteriores.
- El contexto no supone que un ahorro de ubicación desconocida esté separado. La escritura explícita de fuentes de ingreso usa `title` coherentemente con la rama de actualización existente; la lectura admite `name` solo como compatibilidad. No se ejecutó ninguna escritura real para validar esta columna.
- Se usa por defecto la opción documentada de Next 16.4.3 `turbopackPluginRuntimeStrategy: workerThreads`, ya comprobada en el repositorio, para que el comando normal de build funcione en el host que bloquea sockets de procesos de loaders. `ADG_TURBOPACK_WORKERS=0` permite desactivarla.

Los campos numéricos del antiguo DTO visual se mantienen por compatibilidad de componentes; no se usan como evidencia financiera en las APIs. El perfil canónico nullable y los datos registrados de la respuesta son la referencia para los cálculos y su presentación. No se cambiaron las reglas de Sebas ni se rellenaron datos faltantes en Supabase.

## Validación ejecutada sobre la corrección integrada

| Verificación | Resultado real |
| --- | --- |
| `npm test` | 25 archivos de pruebas; 124 subtests Node aprobados, cero fallos. |
| Pruebas originales de Sebas y precisión | 79 verificaciones aprobadas, sin modificar sus reglas ni resultados esperados. |
| `src/lib/geminiCases.test.ts` | 10/10 escenarios originales aprobados. |
| Mapper | 12 nuevas regresiones: cero/una/varias fuentes, fechas faltantes/vencidas/inválidas, frecuencias, deudas, reservas y preservación de importes. |
| Perfil y presentación | 9 nuevas pruebas de datos conocidos/desconocidos, estados separados, margen inmediato frente a proyección, resumen sin compra y limpieza de precio antiguo. |
| Contexto y recarga | 3 pruebas del proveedor con Supabase/storage aislados: Auth antes de demo, lectura de registros tras recarga/actualización, cambio de cuenta y payload de ingreso coherente. |
| Preguntas y precios | 13 nuevas regresiones de APIs/herramientas: laptop sin precio, consulta general, ejemplo exacto «Quiero unos audífonos de $2,300», referencia $1,800, valores inválidos, mismo perfil en chat/evaluación y rechazo de herencia de otro artículo. |
| UI existente ampliada | Se comprueba que un artículo sin precio limpia el contexto y conserva el nombre pendiente, y que un resumen no habilita compra sin precio. |
| `npx tsc --noEmit` | Aprobado. |
| `npm run lint` | Aprobado con 0 errores y 18 advertencias existentes de variables/imports e imágenes. |
| `npm run build` | Aprobado con el comando normal; compila, valida TypeScript y genera las 15 páginas/rutas, incluida `/api/evaluate`. Sin reasignaciones ilegales de `const`. |
| `git diff --check` | Aprobado. |
| Consulta de metadatos Supabase, repetida durante esta corrección | Tras habilitar conectividad, devuelve HTTP 401. No se leyeron filas personales ni se certificaron columnas/RLS desplegadas. |

Las pruebas actuales de Supabase y Gemini utilizan dobles/mocks; las pruebas del proveedor ejercitan sus handlers reales con un cliente aislado. No se afirma que existan esos registros en la cuenta real ni que se haya auditado RLS. En esta corrección no se volvieron a ejecutar llamadas reales a Gemini; los reportes de la integración anterior son históricos y están separados de estas pruebas.

No se borraron registros, ejecutaron migraciones, cambiaron credenciales ni realizaron simulaciones con escrituras. La persistencia real del RPC y una lectura autenticada de la cuenta siguen requiriendo acceso válido a Supabase. Las fechas de ingreso y ubicaciones de ahorro realmente desconocidas siguen pidiendo confirmación.

## Archivos modificados o creados en esta corrección

- `docs/financial-chat-integration.md`
- `docs/financial-data-regression.md`
- `next.config.ts`
- `src/app/api/ai/chat/route.ts`
- `src/app/api/evaluate/route.ts`
- `src/app/app/evaluate/page.tsx`
- `src/app/app/page.tsx`
- `src/components/FinancialChat.tsx`
- `src/components/FinancialDataStatus.tsx`
- `src/components/FinancialPlantWidget.tsx`
- `src/components/PurchaseEvaluationFlow.tsx`
- `src/context/FinancialContext.tsx`
- `src/lib/ai/financialAssistant.ts`
- `src/lib/ai/financialTools.ts`
- `src/lib/ai/productContext.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/schemas.ts`
- `src/lib/finance/evaluation.ts`
- `src/lib/finance/evaluationSelection.ts`
- `src/lib/finance/financialMapper.test.ts`
- `src/lib/finance/financialMapper.ts`
- `src/lib/finance/initialProfile.ts`
- `src/lib/finance/profileDiagnostics.ts`
- `src/lib/onboarding/financialTypes.ts`
- `src/lib/onboarding/saveOnboarding.ts`
- `tests/financial-chat-ui.test.cjs`
- `tests/financial-context-reload.test.cjs`
- `tests/financial-data-display.test.cjs`
- `tests/financial-data-mapper-regression.test.cjs`
- `tests/financial-query-regression.test.cjs`
- `tests/ui-confirmation.test.cjs`
