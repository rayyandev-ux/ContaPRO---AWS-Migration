# Plan de Corrección: Memoria a Corto Plazo y RAG

Se ha detectado que el agente no recuerda el mensaje inmediatamente anterior (como el gasto de la pizza). Esto se debe a una desincronización en cómo se guarda y se carga el historial de chat a corto plazo (Caché), lo que obliga al agente a "adivinar" usando fragmentos aleatorios de la memoria a largo plazo (RAG).

## 1. Corrección del Bug de Carga de Historial
Actualmente, el agente guarda el historial asociándolo al perfil activo (`profileId`), pero al leerlo, olvida pedirlo con ese mismo identificador.
*   **Archivo:** `src/services/agent.ts`
*   **Acción:** Cambiar `const history = await this.loadHistory(userId);` por `const history = await this.loadHistory(userId, activeProfileId);`. Esto sincronizará la lectura y escritura de la memoria a corto plazo, permitiendo que el agente vea los últimos mensajes de la conversación actual.

## 2. Prevención de Basura en la Memoria a Largo Plazo (RAG)
Para evitar que el agente recupere frases sueltas como "Mejor revierte eso" o "Ok", limitaremos qué tipo de mensajes se guardan en la base de datos vectorial.
*   **Archivo:** `src/services/agent.ts` (en las llamadas a `saveMemory`)
*   **Acción:** Evitar guardar mensajes del usuario muy cortos (menores a 10 caracteres o que no aporten contexto a largo plazo) para mantener la base de datos RAG limpia y relevante.

## 3. Refuerzo en las Instrucciones del Prompt
*   **Acción:** Añadir una directiva en el `systemPrompt` indicando que para preguntas como "¿qué te acabo de decir?" o referencias al contexto inmediato, DEBE revisar el historial de la conversación actual (los mensajes del chat) antes de buscar en la `[MEMORIA RECUPERADA]`.

## Pasos de Ejecución
1. Modificar `agent.ts` para pasar `activeProfileId` a `loadHistory`.
2. Modificar el método `saveMemory` (o sus invocaciones) en `agent.ts` para ignorar textos cortos.
3. Actualizar la sección de reglas de memoria en el prompt del sistema.