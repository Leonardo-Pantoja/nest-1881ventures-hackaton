# Auditoría de ingresos del copiloto conversacional

Fecha de comprobación: 25 de octubre de 2026. Alcance: código, historial Git, pruebas aisladas y consulta remota de metadatos sin leer registros personales. No se ejecutaron escrituras, migraciones ni cambios de políticas en Supabase.

## Estado real verificable

**No fue posible verificar las filas de ingresos de la cuenta reportada.** Se repitió `scripts/inspect-financial-schema.cjs`, que únicamente solicita OpenAPI y muestra nombres de columnas. En el sandbox falló la resolución de red (`ENOTFOUND`); con conectividad autorizada respondió **HTTP 401**. Ese resultado corresponde al acceso a metadatos con la configuración disponible; no demuestra que fallen todas las sesiones autenticadas de la aplicación ni que no existan ingresos en la base.

Los valores de saldo de $3,000, reserva de $650 y gasto diario de $210 son el ejemplo aportado en la solicitud. Esta auditoría no los obtuvo de una cuenta real. No se imprimieron claves, sesiones ni conversaciones.

No hay definiciones SQL de tablas, políticas RLS, migraciones de ingresos ni cuerpo SQL de `complete_financial_onboarding` en el árbol o historial inspeccionados. Por ello, los nombres de columna siguientes son **el contrato utilizado por el código**, no una certificación del esquema desplegado.

## Qué lee cada flujo

| Origen | Lectura y transformación comprobadas |
| --- | --- |
| [`accountSnapshot.ts`](../src/lib/finance/accountSnapshot.ts) | Verifica identidad mediante `auth.getUser()`. Lee `profiles.id = user.id`; para `income_sources` exige `user_id = user.id` e `is_active = true`. Rechaza errores de consulta y pasa las filas al mapper. No usa un perfil financiero del navegador como respaldo. |
| [`FinancialContext.tsx`](../src/context/FinancialContext.tsx) | Usa los mismos filtros para ingresos, ordena por `next_payment_date` y reutiliza `mapSupabaseRecord()` para el perfil financiero canónico autenticado. Los campos numéricos antiguos de presentación no sustituyen esa instantánea en el motor. |
| [`financialMapper.ts`](../src/lib/finance/financialMapper.ts) | Lee `income_sources.amount`, `frequency` y `next_payment_date`; conserva las fuentes activas recibidas y genera diagnósticos separados para ausencia de fuentes, fecha ausente/vencida/inválida, importe desconocido y calendarios múltiples. |
| `profiles` | Aporta `current_balance`, `safety_buffer`, `daily_essential_budget`, `onboarding_completed_at` y otros campos de identidad/configuración. No se encontró un salario persistido en `profiles` que el contrato actual permita usar como alternativa. Un `select("*")` no prueba la existencia de columnas de salario desconocidas. |

En una consulta sin error, “sin fuentes activas registradas” significa que **no llegaron filas activas visibles para esa sesión**. No permite distinguir entre inexistencia, filas inactivas, valores de actividad nulos, propietario diferente o una política RLS que oculta filas. El filtro SQL `is_active = true` excluye tanto `false` como `null`; el filtrado defensivo del mapper (`!== false`) no recupera filas que la consulta nunca devolvió. Sin inspeccionar esquema y permisos no sería correcto cambiar el filtro ni interpretar un `null` como consentimiento de actividad.

Un error explícito de Supabase tampoco debe transformarse en una lista vacía: la instantánea actual falla con `financial_data_unavailable`. Una política RLS puede devolver una lista vacía sin un error, por lo que los filtros de aplicación y sus mocks no certifican la política desplegada.

## Onboarding y escritura de ingresos

[`saveOnboarding.ts`](../src/lib/onboarding/saveOnboarding.ts) verifica Auth y llama a `complete_financial_onboarding` con `p_next_payday_amount`, `p_next_payday_days` y `p_pay_frequency`, además de saldo, reserva, gasto y compromisos. Después, el contexto vuelve a leer la base; no considera el objeto temporal del onboarding una fuente financiera autoritativa.

[`onboarding/page.tsx`](../src/app/onboarding/page.tsx) envía importe y días en cero cuando el usuario indica que no tiene ingreso regular (`hasRegularIncome = false`). Sin el SQL del RPC no puede afirmarse si ese caso omite una fuente, crea una fuente de importe cero o aplica otra regla. Tener onboarding completado tampoco prueba por sí solo que haya una fuente activa con fecha futura.

El editor existente guarda explícitamente `income_sources.user_id`, `title`, `amount`, `frequency`, `next_payment_date` e `is_active: true`. Tanto crear como actualizar utilizan ahora `title`; la lectura visual admite `title ?? name` por compatibilidad.

La inconsistencia histórica sí está comprobada: el commit `bb0ddde` cambió la actualización a `title` pero mantuvo `name` en la inserción. `02bf537` corrigió esa inserción. Esto explica una posible incompatibilidad del código anterior, pero **no demuestra que una escritura concreta fallara ni que se hayan perdido filas**. La validación aislada confirma el payload actual; no realizó una inserción remota.

Los modelos anteriores incluían `nextPaydayAmount` y `nextPaydayDays` en el perfil del cliente y en almacenamiento local/demo. No se encontró evidencia de que esos objetos constituyan una tabla alternativa de salarios. El contexto actual descarta el almacenamiento legado y comprueba Auth antes de restaurar un demo. Recuperar esos datos para cuentas autenticadas introduciría información no validada y posiblemente de otra cuenta.

## Causas que el código permite diferenciar

| Situación | Comportamiento comprobado | ¿Explica “cero fuentes activas” por sí sola? |
| --- | --- | --- |
| No llegan fuentes activas | Conserva saldo, reserva y gasto conocidos; próximo importe y fecha quedan desconocidos. | Sí, describe el resultado visible; la causa remota sigue sin comprobarse. |
| Una fecha vencida, ausente o inválida | Conserva la fuente y su importe válido, deja el horizonte desconocido y emite el diagnóstico específico. No avanza la fecha ni acredita el pago. | No. Una fecha inválida no elimina la fuente recibida. |
| Varias fuentes con todas sus fechas confirmadas | Usa la fecha más próxima y suma en centavos solamente los importes de ese día. Solo repite una frecuencia si los calendarios están sincronizados. | No. Se conservan las fuentes. |
| Una fecha desconocida entre varias fuentes | Conserva los importes individuales; no afirma cuál es el siguiente ingreso y no extrapola calendarios. | No. Puede impedir la proyección sin borrar las fuentes. |
| Frecuencia variable/desconocida | Conserva importe y horizonte confirmados, cuando existan; la proyección futura puede seguir incompleta aunque Safe-to-Spend inmediato sea calculable. | No. |
| `is_active = false` o `null` | La consulta actual no devuelve esa fila. | Posible; no se inspeccionaron filas reales. |
| Columna incompatible, RPC que no guarda, propietario o RLS incorrectos | No se pueden certificar con el repositorio y metadatos inaccesibles. Un error explícito no se oculta como dato vacío. | Pendiente de auditoría autenticada; no es una causa demostrada. |

## Acción existente para completar datos

El dashboard `/app` tiene la pestaña **Editar Perfil**, que renderiza [`ProfileEditorPanel.tsx`](../src/components/ProfileEditorPanel.tsx). Dentro está **Ingresos y Pagos Fijos → Mis Ingresos → Agregar fuente de ingreso**. Es el flujo existente para que el usuario confirme y guarde un ingreso y su fecha.

En el estado inicial de esta auditoría las pestañas eran estado local (`activeBottomTab = "profile"`, subpestaña `ingresos`), sin una URL de edición ni ancla publicada. La acción del chat debe abrir ese panel mediante navegación explícitamente implementada, sin inventar una ruta. No debe guardar ingresos por conversar.

El formulario existente permite semanal, quincenal, mensual o único; exige un importe positivo y una fecha y presenta valores iniciales editables. Estos valores iniciales no son ingresos confirmados. Si el usuario indica que no tiene ingresos, el chat debe reconocerlo y permitir continuar; si son variables, no debe convertirlos en una nómina fija ni persistir una frecuencia inventada para satisfacer el formulario.

## Evidencia ejecutada

Las siguientes pruebas se ejecutaron en esta auditoría con datos sintéticos y dobles de Supabase, sin lecturas ni escrituras de una cuenta real:

| Comando | Resultado |
| --- | --- |
| `node scripts/test.cjs tests/financial-data-mapper-regression.test.cjs` | 12 pruebas aprobadas: ausencia de fuentes, fechas vencidas/inválidas/ambiguas, múltiples calendarios, frecuencias variables, fondos protegidos y preservación de cifras conocidas. |
| `node scripts/test.cjs tests/financial-chat-snapshot.test.cjs` | 3 pruebas aprobadas: identidad Auth, filtros de propietario/actividad, rechazo de sesión ausente y errores de consulta sin exponer detalles. |
| `node scripts/test.cjs tests/financial-context-reload.test.cjs` | 3 pruebas aprobadas: lectura canónica después de recarga/onboarding, cambio de cuenta y creación explícita con `title` en el doble aislado. |
| `node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/inspect-financial-schema.cjs` | Acceso remoto autorizado a metadatos: HTTP 401. No certifica columnas, filas, RPC ni RLS. |

Queda pendiente una auditoría con una sesión válida y acceso de diagnóstico a la base que permita verificar columnas, cuerpo del RPC, políticas y filas activas/inactivas del propietario. Hasta entonces, la conclusión verificable es que el código separa ausencia visible de fuentes, problemas de fecha y calendarios incompatibles; **el estado de persistencia de los ingresos de la cuenta real no se pudo confirmar**.
