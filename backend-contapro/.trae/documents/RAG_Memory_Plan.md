# Plan de Implementación: Sistema RAG y Memoria Contextual Anti-Alucinaciones

Este plan detalla cómo implementar una memoria a largo plazo para el agente conversacional en `AgentService`, utilizando Generación Aumentada por Recuperación (RAG) para recordar chats pasados y preferencias, aplicando salvaguardas estrictas para evitar que el LLM invente o reutilice datos de forma incorrecta.

## 1. Preparación de la Base de Datos (PostgreSQL + pgvector)
Dado que el proyecto utiliza PostgreSQL y Prisma, la forma más nativa y eficiente de implementar RAG es mediante la extensión `pgvector`.

*   **Paso 1.1:** Actualizar `prisma/schema.prisma` para habilitar la extensión de PostgreSQL y crear el modelo `Memory`.
    ```prisma
    generator client {
      provider        = "prisma-client-js"
      previewFeatures = ["postgresqlExtensions"]
    }

    datasource db {
      provider   = "postgresql"
      url        = env("DATABASE_URL")
      extensions = [vector]
    }

    model Memory {
      id        String   @id @default(uuid())
      userId    String
      content   String   // El texto del mensaje o hecho extraído
      role      String   // "user", "assistant" o "fact"
      embedding Unsupported("vector(1536)")
      createdAt DateTime @default(now())
      user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

      @@index([userId])
    }
    ```
*   **Paso 1.2:** Crear un script de migración SQL vacío (`npx prisma migrate dev --create-only`) y añadir la instrucción `CREATE EXTENSION IF NOT EXISTS vector;` antes de la creación de la tabla, para asegurar que la base de datos soporte vectores.
*   **Paso 1.3:** Ejecutar la migración (`npx prisma migrate dev`).

## 2. Servicio de Embeddings y Memoria
Crear un nuevo servicio o métodos dentro de `agent.ts` para manejar la vectorización usando la API de OpenAI.

*   **Paso 2.1:** Crear función para generar embeddings usando `text-embedding-3-small` (más rápido y económico).
    ```typescript
    async getEmbedding(text: string): Promise<number[]> {
        const response = await this.openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
        });
        return response.data[0].embedding;
    }
    ```
*   **Paso 2.2:** Crear función `saveMemory(userId, content, role)` que genere el embedding y ejecute un `prisma.$executeRaw` para insertar el vector (ya que Prisma requiere raw queries para el tipo `Unsupported("vector")`).
*   **Paso 2.3:** Crear función `searchMemory(userId, query, limit = 5)` que:
    1. Genere el embedding del query actual.
    2. Realice una búsqueda de similitud coseno (`<=>`) en PostgreSQL usando `prisma.$queryRaw`.
    3. Filtre por un umbral de similitud (ej. `<=> < 0.3` para asegurar alta relevancia) para **evitar recuperar contexto irrelevante que cause alucinaciones**.

## 3. Estrategia Anti-Alucinaciones: "Extracción de Hechos" vs "Raw Chat"
Para evitar que el agente asuma que una conversación pasada está ocurriendo *ahora* (ej. recuperar un gasto de hace 2 meses y volver a registrarlo), no guardaremos el chat crudo como memoria operativa general. 

*   **Paso 3.1:** Filtrado Temporal. Cada memoria recuperada debe tener un sello de tiempo estricto.
*   **Paso 3.2 (Recomendado):** En lugar de guardar cada "Hola", ejecutar un proceso en segundo plano (background job) después de cada conversación que resuma la interacción en **hechos o preferencias** concretas (Ej. "El usuario prefiere que los gastos de Uber vayan a la categoría Transporte", "El usuario mencionó que tiene un viaje planeado en Diciembre").

## 4. Integración en `agent.ts` (`processMessage`)
Modificar el flujo principal para inyectar la memoria recuperada de forma segura.

*   **Paso 4.1:** Al inicio de `processMessage`, hacer la búsqueda vectorial:
    ```typescript
    const relevantMemories = await this.searchMemory(userId, text);
    ```
*   **Paso 4.2:** Formatear estas memorias en texto con fechas explícitas:
    ```typescript
    let memoryContext = "";
    if (relevantMemories.length > 0) {
        memoryContext = `\n[MEMORIA RECUPERADA DE CHATS PASADOS]\n` +
        relevantMemories.map(m => `- (${formatDMY(m.createdAt)}): ${m.content}`).join('\n') +
        `\n\nREGLA CRÍTICA: La información de arriba es SOLO contexto histórico. NO ejecutes herramientas (como registrar gastos) basándote en esta memoria a menos que el usuario lo pida explícitamente AHORA. Si la respuesta no está aquí, NO la inventes.`;
    }
    ```
*   **Paso 4.3:** Inyectar `memoryContext` en el `systemPrompt` existente, preferiblemente cerca de la sección `[CONTEXTO ACTIVO / THREAD MEMORY]`.
*   **Paso 4.4:** Después de generar y enviar la respuesta al usuario, guardar la interacción actual en la tabla de memoria de forma asíncrona:
    ```typescript
    // Fire and forget para no aumentar la latencia de respuesta
    this.saveMemory(userId, text, 'user').catch(console.error);
    this.saveMemory(userId, finalMessage.content, 'assistant').catch(console.error);
    ```

## 5. Prevención Específica de Reutilización de Datos (Guardrails)
Añadir las siguientes reglas al `systemPrompt` para blindar al agente:
1.  **Aislamiento de Tareas:** *"Los eventos listados en [MEMORIA RECUPERADA] ya sucedieron. NO los confundas con el [CONTEXTO ACTIVO]."*
2.  **Transparencia de Ignorancia:** *"Si el usuario te pregunta algo sobre su pasado ('¿qué te dije ayer sobre X?') y no está en [MEMORIA RECUPERADA], responde: 'No tengo ese dato en mis registros recientes', NO intentes adivinarlo."*
3.  **Desambiguación de Entidades:** Si la búsqueda vectorial trae un gasto parecido, el agente debe preguntar antes de asumir (ej. *"Veo que antes registraste un taxi por S/ 20, ¿es el mismo monto hoy?"*).

## Resumen de Tareas (Para TodoList futuro):
1. Añadir extensión pgvector al entorno de BD.
2. Actualizar `schema.prisma` y ejecutar migraciones.
3. Implementar funciones de OpenAI Embeddings.
4. Implementar CRUD vectorial (Query Raw en Prisma).
5. Inyectar recuperación en `agent.ts`.
6. Refinar `systemPrompt` con las reglas Anti-Alucinación.
