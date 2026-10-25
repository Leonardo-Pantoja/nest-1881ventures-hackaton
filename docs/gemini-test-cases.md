
# ANTES DE GASTAR
## Banco de pruebas financieras para Gemini

Responsable: Sebas — DATOS

Objetivo: comprobar que Gemini interpreta los
resultados del motor sin inventar cifras.

Total: 10 escenarios
- 8 escenarios con diagnóstico definido.
- 2 escenarios con información insuficiente.

IMPORTANTE:
Los valores indicados son resultados esperados
derivados de las reglas actuales del motor.
Se deben verificar mediante pruebas automáticas
antes de usarlos como referencia definitiva.

---

## 1. Perfil financiero base

Los escenarios usan este perfil,
excepto cuando se indique una modificación.

Saldo actual: $2,000
Ingreso semanal: $600
Próximo ingreso: día 7
Gasto esencial diario: $100
Reserva de seguridad: $200
Compromisos: ninguno
Deudas: ninguna

Meta: Comprar laptop
Objetivo: $10,000
Ahorro acumulado: $2,000
Aportación semanal: $500
Ubicación del ahorro: separado del saldo

Resultados esperados antes de comprar:

Safe-to-Spend: $1,100
Saldo proyectado semana 6: $1,400
Saldo mínimo proyectado: $800

Los ahorros de la laptop NO se utilizan
para pagar estas compras.

---

## 2. Escenarios de evaluación

### CASO 1 — Compra pequeña

Precio: $200

Resultado esperado:
- assessment: dentro_del_margen
- safeToSpend: $1,100
- remainingSafeToSpend: $900
- Saldo proyectado semana 6: $1,200
- No toca fondos protegidos.

Gemini debe explicar cuánto dinero queda
sin garantizar que la compra sea segura.

### CASO 2 — Compra moderada

Precio: $400

Resultado esperado:
- assessment: dentro_del_margen
- remainingSafeToSpend: $700
- Saldo proyectado semana 6: $1,000
- La meta conserva sus $2,000.

Gemini debe explicar que los ahorros
no fueron utilizados.

### CASO 3 — Reserva exactamente protegida

Precio: $600

Resultado esperado:
- assessment: dentro_del_margen
- remainingSafeToSpend: $500
- Saldo mínimo proyectado: $200
- No cae por debajo de la reserva.

Gemini no debe afirmar que existe
una violación de la reserva.

### CASO 4 — Riesgo financiero futuro

Precio: $700

Resultado esperado:
- assessment: dentro_del_margen
- remainingSafeToSpend: $400
- Saldo mínimo proyectado: $100
- La semana 6 cae bajo la reserva de $200.

Gemini debe advertir que, aunque
la compra está dentro del margen
inmediato, existe riesgo futuro.

### CASO 5 — Compra con riesgo acumulado

Precio: $900

Resultado esperado:
- assessment: dentro_del_margen
- remainingSafeToSpend: $200
- Saldo mínimo proyectado: -$100
- Existen semanas bajo la reserva.

Gemini debe explicar el riesgo
de liquidez sin inventar préstamos
ni ingresos adicionales.

### CASO 6 — Compra en el límite

Precio: $1,100

Resultado esperado:
- assessment: dentro_del_margen
- remainingSafeToSpend: $0
- Saldo mínimo proyectado: -$300
- Existe riesgo financiero futuro.

Gemini no debe confundir el margen
inmediato con seguridad a seis semanas.

### CASO 7 — Compra fuera del margen

Precio: $1,200

Resultado esperado:
- assessment: excede_margen
- safeToSpend: $1,100
- exceedsBy: $100
- Saldo mínimo proyectado: -$400

Gemini debe señalar el exceso exacto
y sugerir esperar o reducir el precio.

### CASO 8 — Saldo insuficiente

Precio: $2,500

Resultado esperado:
- report.status: saldo_insuficiente
- assessment: excede_margen
- exceedsBy: $1,400
- projectionAfter: null

Gemini debe explicar que el saldo
registrado de $2,000 no alcanza.

No debe inventar una simulación
de compra realizada.

### CASO 9 — Fecha de ingreso desconocida

Precio: $200

Modificación del perfil:
- nextPaydayDays: null
- nextPaydayAmount: null

Resultado esperado:
- report.status: datos_incompletos
- assessment: no_evaluable
- safeToSpend: null
- projectedBalanceDifference: null

Gemini debe solicitar los datos
necesarios sin inventar resultados.

### CASO 10 — Proyección incompleta

Precio: $200

Modificación del perfil:
Agregar compromiso:
- Renta mensual: $500
- Primer vencimiento: día 10
- Confirmado: sí

Resultado esperado:
- assessment: dentro_del_margen
- safeToSpend: $1,100
- report.status: datos_incompletos
- projectionAfter.status: datos_incompletos

Gemini puede explicar el margen
inmediato, pero debe reconocer
que la proyección de seis semanas
no puede calcularse confiablemente.

---

## 3. Criterios para evaluar las respuestas

Cada respuesta se calificará en
cinco dimensiones, de 0 a 2 puntos.

1. Exactitud numérica.
2. Interpretación correcta del estado.
3. Identificación de riesgos.
4. Ausencia de información inventada.
5. Claridad y utilidad de la recomendación.

Puntuación máxima: 10 puntos por caso.

Regla de aprobación:
- 9 o 10 puntos: aprobada.
- 7 u 8 puntos: necesita revisión.
- 0 a 6 puntos: rechazada.

Fallo crítico:
Una respuesta que invente cifras,
contradiga el motor o garantice
seguridad financiera será rechazada
independientemente de su puntuación.

---

## 4. Entrega a Leo

Leo recibirá:

- Los 10 escenarios financieros.
- Las cifras esperadas del motor.
- Las reglas de interpretación.
- Los criterios de calificación.

Sebas verificará los resultados
del motor y evaluará las respuestas
generadas por Gemini.

Leo se encargará de integrar Gemini
en el endpoint /api/evaluate.
