# Plan de Reorganización y Conexión de Datos (Dashboard)

## 1. Resumen
Se reorganizará el layout del Dashboard para que sea original (no un plagio de la referencia) y ocupe mejor el espacio en escritorio. Además, se conectarán los componentes "Metas", "Cuentas" y "Racha" al backend, consumiendo los endpoints existentes y calculando la racha a partir de la data de tendencias.

## 2. Nuevo Layout Propuesto (12 Columnas)

**Fila 1:**
* **Balance (lg:col-span-9):** Gráfico principal de área, más ancho y prominente.
* **Racha (lg:col-span-3):** Tarjeta compacta a la derecha del balance con el cálculo de días consecutivos.

**Fila 2:**
* **Distribución por Categoría (lg:col-span-4):** Gráfico de Donut.
* **Flujo por Categoría (lg:col-span-8):** Gráfico de barras apiladas horizontales, ahora con más espacio para mostrar las etiquetas claramente.

**Fila 3:**
* **Últimas Transacciones (lg:col-span-4):** Lista scrolleable.
* **Metas (lg:col-span-4):** Integrado con el endpoint de metas.
* **Cuentas (lg:col-span-4):** Integrado con el endpoint de métodos de pago.

*Todas las tarjetas mantendrán el estilo Glassmorphism y tendrán alturas consistentes (ej. `min-h-[350px]`) para que el grid se vea uniforme y ocupe bien el escritorio.*

## 3. Conexión al Backend

### 3.1. Modificaciones en `page.tsx`
Se agregarán dos peticiones al `Promise.all` existente:
1. `fetch(`${BASE}/api/savings/goals`)` para obtener las metas.
2. `fetch(`${BASE}/api/payment-methods`)` para obtener las cuentas/métodos de pago.

Se extraerán estos datos y se pasarán como props al componente `ChartPanel`.

### 3.2. Lógica de "Racha" (Streak)
* No es necesario crear un endpoint nuevo en el backend (que está en otro repositorio), ya que podemos calcular la racha usando `trendData` (que trae el gasto por día del mes).
* **Cálculo:** Iteraremos sobre `trendData` para encontrar el número máximo de días consecutivos con `spent > 0`.
* **Transacciones en el mes:** Lo sacaremos de la longitud del array `resExpenses` o de los días activos en `trendData`.

### 3.3. Actualización de `ChartPanel.tsx`
* Recibirá los nuevos props: `goals` y `paymentMethods`.
* Reemplazará `mockAccounts` con `paymentMethods`.
* Reemplazará la data mockeada de "Metas" con el primer elemento de `goals` (o un resumen si hay varias).
* Reorganizará el JSX para reflejar el nuevo Grid propuesto en el paso 2.

## 4. Pasos de Implementación
1. Actualizar `page.tsx` para hacer fetch de `/api/savings/goals` y `/api/payment-methods`.
2. Actualizar las interfaces de `Props` en `ChartPanel.tsx`.
3. Implementar el algoritmo de cálculo de "Racha" dentro de `ChartPanel.tsx`.
4. Modificar el layout en `ChartPanel.tsx` para aplicar la nueva distribución de filas y columnas.
5. Renderizar la data real en las tarjetas de Metas y Cuentas.
6. Ajustar detalles visuales (alturas, paddings) para asegurar que ocupe bien el espacio en escritorio sin verse amontonado.