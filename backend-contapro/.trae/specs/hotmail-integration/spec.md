# Integración con Outlook / Hotmail (Microsoft Graph)

## Why
Actualmente, ContaPRO solo soporta la integración con Gmail para el escaneo automático de gastos. Muchos usuarios utilizan cuentas de Microsoft (Outlook, Hotmail, Live, Office 365) y están solicitando esta funcionalidad. Integrar Microsoft Graph permitirá expandir la base de usuarios soportados y automatizar la contabilidad para este segmento.

## What Changes
- **Backend**:
    - Agregar configuración de OAuth2 para Microsoft en `src/index.ts` y `src/config.ts`.
    - Implementar rutas de autenticación (`/outlook/connect`, `/outlook/callback`) en `src/routes/integrations.ts`.
    - Modificar `src/workers/emailScanner.ts` para soportar la lógica de Microsoft Graph API (obtención de correos, renovación de tokens).
    - Agregar endpoints de estado y configuración (`/outlook/status`, `/outlook/settings`) en `src/routes/integrations.ts`.
- **Database**:
    - El modelo `EmailIntegration` ya soporta `provider`, se usará el valor `'OUTLOOK'`. No se requieren cambios de esquema si `provider` es String. Si es Enum, se debe agregar `OUTLOOK`. (Verificación pendiente: Asumiremos String por ahora, si es Enum se ajustará).

## Impact
- **Affected specs**: Integraciones de correo.
- **Affected code**:
    - `src/index.ts` (Registro de OAuth provider).
    - `src/config.ts` (Variables de entorno).
    - `src/routes/integrations.ts` (Nuevos endpoints).
    - `src/workers/emailScanner.ts` (Lógica de escaneo).

## ADDED Requirements
### Requirement: Autenticación con Microsoft
El sistema DEBE permitir iniciar el flujo OAuth2 con Microsoft, solicitando los permisos `User.Read`, `Mail.Read` y `offline_access`.
El sistema DEBE intercambiar el código de autorización por `access_token` y `refresh_token` y almacenarlos cifrados.

### Requirement: Escaneo de Correos Outlook
El sistema DEBE ser capaz de conectarse a la API de Microsoft Graph usando los tokens almacenados.
El sistema DEBE filtrar los correos por remitente (usando `$filter` de OData) similar a la lógica de Gmail.
El sistema DEBE procesar el cuerpo del correo (HTML o Texto) y enviarlo al Agente de IA para extracción.

### Requirement: Renovación de Tokens
El sistema DEBE detectar cuando un token de acceso de Microsoft ha expirado y usar el `refresh_token` para obtener uno nuevo automáticamente durante el proceso de escaneo.

## MODIFIED Requirements
### Requirement: Email Scanner Worker
El worker actual solo itera integraciones de Gmail. Se MODIFICARÁ para iterar todas las integraciones activas y despachar la lógica correspondiente según el `provider` (`GMAIL` o `OUTLOOK`).
