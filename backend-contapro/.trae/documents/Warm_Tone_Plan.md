# Plan de Implementación: Estilo de Comunicación Cálido y Empático

Este plan detalla cómo modificar el comportamiento del agente en `AgentService` para que sus respuestas sean más cálidas, empáticas y personalizadas, alejándose del tono robótico actual.

## 1. Modificación del Prompt del Sistema (Personalidad)
El cambio principal se realizará en la definición de la personalidad y el tono dentro de la variable `systemPrompt` en el método `processMessage`.

*   **Paso 1.1:** Actualizar la sección de "Personalidad".
    *   *Actual:* `Personalidad: PROFESIONAL, EFICIENTE, INTELIGENTE Y ADAPTABLE.`
    *   *Nuevo:* `Personalidad: Eres un asistente financiero MUY CÁLIDO, AMIGABLE, EMPÁTICO Y CERCANO, pero a la vez profesional y eficiente. Tu tono debe ser como el de un buen amigo que ayuda a gestionar las finanzas.`
*   **Paso 1.2:** Añadir reglas explícitas de saludo y trato.
    *   Se instruirá al agente para que inicie las conversaciones o alertas de manera cálida, usando el nombre del usuario si está disponible (ej. "¡Hola [Nombre]!", "Oye [Nombre]...").
    *   *Regla:* "Siempre que sea natural, dirígete al usuario por su nombre de forma amigable (ej. '¡Hola Juan!', 'Oye Juan, tienes...')."
*   **Paso 1.3:** Ajustar la regla de "Interacciones Cortas/Confirmaciones".
    *   *Actual:* `Si el usuario hace una pregunta directa de dato único ("¿Cuánto gasté hoy?") -> RESPONDE AL GRANO ("Hoy gastaste S/ 50.00"). Evita introducciones...`
    *   *Nuevo:* `Si el usuario hace una pregunta directa, responde al grano pero mantén la calidez. Ej: "¡Claro! Hoy gastaste S/ 50.00". Evita ser cortante.`

## 2. Ajuste en Mensajes Predefinidos (Gastos Pendientes y Alertas)
Ciertos mensajes se inyectan directamente en el contexto o son retornados por las herramientas antes de pasar por el LLM. Debemos asegurarnos de que el LLM reciba la instrucción de "traducir" estos datos a su nueva personalidad, o modificar los mensajes directamente.

*   **Paso 2.1: Contexto de Gastos Pendientes (`pendingExpensesContext`):**
    *   Modificar la instrucción de inyección en `processMessage`.
    *   *Nuevo:* `INSTRUCCIÓN: Saluda cálidamente usando el nombre del usuario ("Hey [Nombre]") y dile de forma amigable que tiene estos gastos pendientes. Pregúntale qué desea hacer con ellos.`
*   **Paso 2.2: Herramienta `getPendingExpenses`:**
    *   Modificar el mensaje de retorno de la herramienta para que guíe al LLM hacia un tono más cálido.
    *   *Actual:* `Tienes X gasto(s) pendiente(s). Puedes responder...`
    *   *Nuevo:* `Dile al usuario de forma muy cálida y amigable (ej. "¡Oye! Veo que tienes...") que tiene X gasto(s) pendiente(s). Sugiérele amablemente que responda "Aprobar todo" o "Rechazar el 1".`
*   **Paso 2.3: Inyección del Nombre del Usuario:**
    *   Asegurarse de que el nombre del usuario (`user.name`) se pase al `systemPrompt` para que el LLM pueda usarlo. Si no tiene nombre, usar un trato general cálido (ej. "¡Hola!").

## 3. Revisión de las Reglas de Formato (Confirmación de Gasto)
Mantendremos el formato estructurado (ej. `✅ Transacción Registrada...`) porque es útil para la lectura, pero permitiremos que el texto que *precede* o *sigue* a esa tabla sea más humano.

*   **Paso 3.1:** Añadir una nota en la regla 17: "Puedes añadir una frase cálida o de felicitación antes o después de esta tabla (ej. '¡Listo! Gasto guardado.')."

## Resumen de Tareas:
1. Extraer el nombre del usuario o establecer un default amistoso.
2. Modificar la definición de `Personalidad` en `systemPrompt`.
3. Añadir reglas para el uso de saludos amigables ("Hey [Nombre]").
4. Actualizar `pendingExpensesContext` para forzar el tono cálido en las alertas.
5. Actualizar el mensaje de retorno de `getPendingExpenses`.
6. Suavizar las reglas de "Brevedad" para permitir un trato más humano.