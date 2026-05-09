# Plan de Implementación: Resumen Diario en Imagen

El objetivo es enviar al usuario un resumen diario de sus gastos en formato de imagen, utilizando una plantilla prediseñada (sin IA generativa para la imagen en sí) y rellenándola con datos reales (total gastado, gasto más alto, gráficos y un tip financiero).

## 1. Estrategia de Generación de Imagen (Plantilla + Datos)
Dado que no queremos usar IA para generar la imagen (por costos, consistencia y control de diseño), la mejor estrategia en Node.js/Backend es generar la imagen a partir de HTML/CSS utilizando una librería como `puppeteer` (o un servicio equivalente). 

**Flujo propuesto:**
1. Crear una plantilla HTML/CSS bonita (con Tailwind o CSS puro) que reciba variables.
2. Inyectar los datos del usuario (total, gasto más alto, tip, datos del gráfico) en ese HTML.
3. Usar `puppeteer` para tomar un *screenshot* de ese HTML y guardarlo como imagen (`.png` o `.jpeg`).
4. Enviar la imagen a través del bot de WhatsApp.

## 2. Recopilación de Datos (El Trabajo Diario)
Necesitamos un proceso programado (Cron Job) que se ejecute al final del día (ej. 23:50 PM).

*   **Paso 2.1: Crear el Cron Job:** Usar `node-cron` o el sistema de tareas actual para ejecutar una función diaria.
*   **Paso 2.2: Obtener Usuarios Activos:** Filtrar los usuarios que tienen notificaciones activas y que hayan registrado gastos en el día.
*   **Paso 2.3: Consultar Base de Datos:**
    *   **Total de hoy:** Suma de `amountNative` de gastos de hoy.
    *   **Gasto más alto:** Ordenar los gastos de hoy por monto y tomar el primero.
    *   **Datos para el gráfico:** Agrupar gastos de hoy por categoría (ej. Comida: 50, Transporte: 20).
    *   **Tip Diario:** Seleccionar un tip aleatorio de una lista predefinida o usar el LLM de forma rápida para generar un tip de 1 línea basado en el gasto más alto.

## 3. Generación del Gráfico en la Plantilla
Para el gráfico dentro del HTML, la opción más robusta y sin dependencias externas complicadas es usar una librería de gráficos del lado del cliente como `Chart.js` dentro de la plantilla HTML, o generar una URL de gráfico estático (ej. QuickChart.io).
*   *Recomendación:* Usar QuickChart.io (genera imágenes estáticas a partir de parámetros en la URL) e incrustarla en el HTML, o renderizar el HTML completo con `puppeteer` e incluir una gráfica CSS/SVG simple (como barras horizontales de progreso).

## 4. Diseño de la Plantilla (Estructura Sugerida)
El HTML tendría secciones como:
- **Cabecera:** "Tu Resumen Diario - ContaPRO" + Fecha.
- **Bloque Principal:** "Total Gastado Hoy: S/ 150.00".
- **Destacado:** "🔥 Gasto más alto: S/ 80.00 en Restaurante".
- **Gráfico (Barras):** Top 3 categorías del día.
- **Footer/Tip:** "💡 Tip: Evita los gastos hormiga, hoy sumaron S/ 15.00."

## 5. Integración con WhatsApp
Una vez generada la imagen y guardada temporalmente (o en memoria como un buffer):
*   Llamar a la API de envío de WhatsApp (`sendMessage` o equivalente en el proveedor actual).
*   Adjuntar la imagen generada.
*   Añadir un mensaje de texto corto acompañando la foto (ej. "¡Hola! Aquí tienes tu resumen de hoy. Que descanses.").

## Resumen de Tareas de Implementación
1. Instalar dependencias necesarias (ej. `puppeteer-core`, motor de plantillas HTML como `ejs` o `handlebars`).
2. Crear la plantilla HTML/CSS (`daily-summary.ejs`).
3. Crear el servicio de recolección de datos diarios (`DailyReportService.ts`).
4. Implementar la función de renderizado HTML -> Imagen.
5. Configurar el Cron Job para disparar el proceso a las 23:50.
6. Probar el envío de la imagen por WhatsApp.