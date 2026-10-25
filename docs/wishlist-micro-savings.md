# Plan de Micro-ahorro conectado con Wishlist

## Estado y despliegue

Implementado en el repositorio y verificado con pruebas de componentes/API, recarga del proveedor y PostgreSQL local con datos sintéticos. **Para habilitar el guardado autenticado se debe revisar y aplicar primero la [migración incremental](../supabase/migrations/202610250001_wishlist_micro_savings.sql).** No se aplicó a la base real.

La consulta autorizada de metadatos de Supabase respondió HTTP 401. No se pudieron certificar columnas, permisos, funciones o políticas desplegadas. El SQL comprueba las columnas base que ya utiliza la aplicación antes de modificar el esquema; no las presenta como verificadas remotamente. No se leyeron registros personales ni se modificaron las credenciales de `.env`.

El orden de despliegue es: comprobar el esquema y permisos existentes, revisar/aplicar ese archivo SQL con el propietario de la base y después publicar el código que usa el RPC nuevo. La función usa permisos del usuario autenticado: necesita las políticas existentes de lectura y actualización de sus propios campos de XP/racha en `profiles`. Si faltan prerrequisitos, hay duplicados históricos o una restricción antigua compara solo nombres, la migración aborta y conserva los registros; no elimina ni fusiona productos automáticamente.

## Causa comprobada

`handleDecisionMicroSave()` en el dashboard y en la evaluación completa solo llamaba a `setChatSuggestion()`. El chat rellenaba el campo de texto, sin una llamada a `addToWishlist()`. En la evaluación completa, Git muestra el reemplazo de `saveAlternative("microsave")` por esa sugerencia durante los cambios de integración; los commits relacionados son `6fc9b3c` y `02bf537`.

`addToWishlist()` ya era asíncrona y utilizaba `save_wishlist_item`, pero seguía teniendo un importe implícito de $400 y comparaciones de duplicados solo por nombre. Retos y Metas también usaba $400 como respaldo y describía el plan como sostenible sin validarlo. El progreso podía preferir metadatos del navegador frente al registro de la base.

## Flujo actual

1. **Plan de Micro-ahorro** abre la misma confirmación compacta en dashboard y evaluación completa. Conserva el producto confirmado, aunque su evaluación financiera esté incompleta.
2. Permite configurar semanas o una aportación semanal. Reutiliza `calculateSavingsTarget()` para aritmética en centavos, partiendo solo del ahorro registrado para ese producto; una compra nueva parte de cero.
3. Muestra objetivo, pendiente, aportación y tiempo aritmético, con sostenibilidad expresamente sin validar. Tenis de $1,800 en seis semanas producen un objetivo de $300 semanales.
4. **Guardar plan en Wishlist** espera el resultado del servidor y su lectura de confirmación en Supabase. Mientras guarda, bloquea nuevas confirmaciones. Un error conserva producto y configuración para reintentar; no dispara éxito, XP local ni cambio de saldo.
5. El éxito permite abrir **Retos y Metas**. `/app#metas` abre esa sección desde la evaluación independiente.
6. **Consultar mi plan con Gemini** es una acción secundaria que prepara una pregunta sobre ahorro sin afectar compromisos. El usuario puede enviarla en el chat existente. Abrir/configurar/guardar el plan no consulta Gemini. La conversación sigue siendo de solo lectura y usa las herramientas financieras actuales.

La confirmación tiene controles de foco y teclado, estados de guardado/error y adaptación a pantallas pequeñas. Se conserva el estilo del dashboard.

## Persistencia y modelo

Se reutilizan `FinancialContext.addToWishlist()` y la tabla **`wishlist_items`**. No se crea otra tabla de Wishlist ni una meta global ficticia.

| Dato | Representación |
| --- | --- |
| Propietario | `user_id`, obtenido de Auth; no se acepta como identidad autoritativa del cliente. |
| Producto y objetivo | `name`, `price`, `strategy = 'microsave'`. La estrategia y las decisiones terminales existentes representan el estado. |
| Creación | `saved_at`, conservado al editar. |
| Aportación semanal | `planned_weekly_save`; se elimina el respaldo implícito de $400. |
| Plazo configurado | `plan_weeks`, nullable; se añade si falta. Una aportación elegida sin plazo conserva ese campo nulo. |
| Progreso específico | `saved_amount`, que se añade con valor inicial cero si falta y se preserva al editar. |
| Pendiente/progreso/tiempo | Derivados del precio, ahorro específico y aportación. Nunca usan el ahorro de otra meta como avance. |

El endpoint `POST /api/wishlist` valida origen, tamaño, esquema, identidad y cuenta esperada. No acepta balances, reservas, progreso ni recompensas proporcionados por el cliente. Llama a `save_wishlist_plan_checked_v1` con la sesión autenticada y vuelve a leer el recibo filtrando propietario e identificador antes de devolver éxito.

El RPC valida producto, centavos, estrategia y plazo; comprueba el ahorro persistido al validar un plazo editado. Inserta o actualiza el registro y devuelve su identificador y los valores confirmados de XP/racha. No actualiza `current_balance`, `goals` ni `transactions`. Los productos nuevos reciben la recompensa existente de 100 XP para microahorro o 50 XP para espera; una edición o repetición recibe cero XP adicional.

Después de guardar, el proveedor incorpora el recibo confirmado. Al recargar o volver a iniciar sesión, recupera los campos desde Supabase. El progreso autenticado no usa `localStorage` como respaldo. Se escucha además `wishlist_items` en el refresco existente por realtime; siguen disponibles el refresco por foco y el periódico.

El modo demo guarda exclusivamente en su sesión demo, con la misma identidad y reglas de edición. Nunca llama a `/api/wishlist` ni escribe en la cuenta autenticada. El cambio de cuenta limpia el perfil anterior y los resultados tardíos no se incorporan a la cuenta nueva.

## Idempotencia y productos existentes

La identidad es **propietario + nombre normalizado + precio en centavos**, sin comparar solo por nombre. Dos productos llamados Tenis a precios diferentes se conservan por separado. Si se trata de variantes distintas con el mismo nombre y precio, se debe confirmar un nombre que identifique la variante; el modelo existente no contiene SKU.

El formulario bloquea doble clic. El proveedor comparte la operación pendiente para una confirmación idéntica y rechaza otra configuración simultánea para el mismo producto. PostgreSQL serializa el guardado y añade un índice único sobre propietario, nombre normalizado y precio; así la protección también existe entre pestañas/instancias del servidor.

Reintentar después de una respuesta perdida recupera el producto existente. Editar conserva identificador, fecha y ahorro, sin repetir XP. Convertir un artículo en espera a microahorro utiliza el mismo registro. Los registros con estado persistido `purchased` o `discarded` no se reabren silenciosamente.

La migración no intenta decidir cuál de dos registros históricos duplicados debe conservarse. El índice falla de forma transaccional si los encuentra; la revisión de esos registros queda en manos del propietario de la base.

## Retos y Metas y las otras decisiones

La tarjeta muestra nombre, objetivo, ahorro específico, pendiente, porcentaje, aportación y plazo/tiempo aritmético disponibles. Muestra **Editar plan de ahorro**, que reutiliza la confirmación, y mantiene acceso a la evaluación de compra. Si el objetivo está reunido, pide evaluar la compra antes de decidir; no afirma liquidez garantizada.

El abono anterior de esta tarjeta escribía primero metadatos locales e ignoraba errores de persistencia. Ese control se sustituyó por edición del plan. Este cambio no introduce transferencias de ahorro ni un registro de aportaciones que pudiera confundirse con dinero reservado. Los importes específicos ya persistidos se conservan y muestran; registrar nuevas aportaciones con consistencia de saldos requiere un flujo transaccional independiente y confirmación explícita.

**Esperar** sigue guardando con `strategy: 'wait'` y **Comprar hoy** mantiene la confirmación existente. Desde Wishlist, evaluar una compra abre ese flujo de evaluación/confirmación, sin registrar una compra con un clic sobre la tarjeta. La eliminación local de un producto comprado también compara nombre y precio para conservar otras variantes.

No se modificaron las fórmulas del motor de Sebas ni se condicionó el guardado del objetivo a tener ingresos completos.

## Pruebas

| Conjunto | Alcance y resultado |
| --- | --- |
| `npm test` | 194 subpruebas Node, 79 verificaciones financieras y 10 escenarios de Sebas. Incluye diez integraciones nuevas; resultado final indicado abajo. |
| `tests/wishlist-microsave.test.cjs` | Formulario, apertura sin Gemini, producto/precio, plazo/aportación, espera de persistencia, doble clic, error/reintento sin éxito falso, edición, XP, recarga desde el doble de base, aislamiento entre cuentas, progreso ajeno ignorado, navegación y demo separado. |
| PostgreSQL local con PGlite | **28/28 comprobaciones reales del SQL**: creación/edición, conservación de registros, duplicados, XP idempotente, campos monetarios, RLS entre usuarios, rechazo anónimo, saldos/metas/movimientos intactos, registros cerrados y rollback por duplicados históricos y restricciones antiguas por nombre. |
| TypeScript, lint y build | Ejecutados; resultados finales al cierre. |

La evidencia de PostgreSQL está en [wishlist-storage-test-results.json](wishlist-storage-test-results.json), con versión, fecha y hash del archivo SQL probado. La base utilizada es sintética y aislada: prueba ejecución de PostgreSQL, **no** el esquema ni las políticas actualmente desplegadas en Supabase.

Para repetir las pruebas de aplicación:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Para repetir la prueba PostgreSQL sin añadir dependencias al proyecto:

```bash
npm install --prefix /tmp/adg-wishlist-sql --no-package-lock --no-audit --no-fund @electric-sql/pglite
ADG_PGLITE_MODULE=/tmp/adg-wishlist-sql/node_modules/@electric-sql/pglite node scripts/test-wishlist-storage.cjs
```

## Archivos

- `src/components/MicroSavingsPlanModal.tsx`: formulario y confirmación compartidos.
- `src/lib/finance/wishlistPlan.ts`: contrato, identidad y aritmética reutilizada.
- `src/app/api/wishlist/route.ts`: guardado autenticado y confirmación del recibo.
- `src/context/FinancialContext.tsx`: estado, persistencia, recarga, bloqueo y separación demo/cuentas.
- `src/app/app/page.tsx`: apertura del plan, navegación a metas y consulta opcional.
- `src/components/PurchaseEvaluationFlow.tsx`: mismo flujo en evaluación completa.
- `src/components/GoalsAndCoolingView.tsx`: progreso específico, edición y navegación a evaluación.
- `supabase/migrations/202610250001_wishlist_micro_savings.sql`: extensión compatible, RPC e integridad/RLS.
- `tests/wishlist-microsave.test.cjs`: integraciones de aplicación.
- `scripts/test-wishlist-storage.cjs`: ejecución aislada del SQL.
- Este documento y `docs/wishlist-storage-test-results.json`: entrega y evidencia.

## Verificación final y pendientes

- `npm test`: aprobado; 194 subpruebas Node, 79 verificaciones financieras y 10/10 escenarios de Sebas, en 30 archivos.
- Integraciones nuevas de Wishlist: 10/10 aprobadas, incluyendo dashboard y evaluación completa.
- SQL en PostgreSQL aislado: 28/28 comprobaciones aprobadas; hash del archivo probado confirmado contra la migración entregada.
- `npx tsc --noEmit`: aprobado.
- `npm run lint`: aprobado, cero errores y 18 advertencias preexistentes. También pasó ESLint de los scripts/pruebas añadidos.
- `npm run build`: aprobado, incluida la nueva ruta `/api/wishlist`.
- `git diff --check`: aprobado.
- Gemini real no fue invocado: la integración opcional conserva el copiloto existente y se verificó que seleccionar/guardar un plan no llama al proveedor.

Pendiente externo: revisar/aplicar la migración y validar una sesión real de guardado/cierre de sesión/recarga en Supabase. El intento de auditoría de metadatos respondió **HTTP 401**. No se ejecutaron migraciones remotas ni una prueba de navegador contra cuentas reales, y no se atribuye a esas cuentas la persistencia observada en las pruebas locales.
