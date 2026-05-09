# Tasks

- [x] Task 1: Configurar OAuth y Rutas de Autenticación para Outlook
  - [x] SubTask 1.1: Registrar el provider `microsoftOAuth2` en `src/index.ts` usando las credenciales de Microsoft Graph.
  - [x] SubTask 1.2: Agregar endpoints `/outlook/connect` y `/outlook/callback` en `src/routes/integrations.ts` para manejar el flujo OAuth.
  - [x] SubTask 1.3: Agregar endpoints de estado (`/outlook/status`) y configuración (`/outlook/settings`) en `src/routes/integrations.ts`.
  - [x] SubTask 1.4: Actualizar `src/config.ts` para incluir las variables de entorno de Microsoft (`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `OUTLOOK_CALLBACK_URL`).

- [x] Task 2: Implementar Lógica de Escaneo de Correos (Worker)
  - [x] SubTask 2.1: Modificar `src/workers/emailScanner.ts` para diferenciar entre integraciones de Gmail y Outlook.
  - [x] SubTask 2.2: Implementar la función de obtención de token renovado para Microsoft Graph usando el `refresh_token`.
  - [x] SubTask 2.3: Implementar la función de búsqueda de correos usando la API de Microsoft Graph (`/me/messages` con `$filter`).
  - [x] SubTask 2.4: Adaptar la lógica de extracción de cuerpo del correo (HTML/Texto) para el formato de Microsoft Graph.

- [x] Task 3: Verificación y Pruebas
  - [x] SubTask 3.1: Probar el flujo de conexión (redirección, login en Microsoft, guardado en BD).
  - [x] SubTask 3.2: Ejecutar el worker manualmente para verificar que descarga correos de Outlook correctamente.
  - [x] SubTask 3.3: Verificar que la IA procesa correctamente los correos descargados de Outlook.

# Task Dependencies
- Task 2 depende de Task 1 (necesitamos tokens guardados para probar el escaneo).
