#!/usr/bin/env bash
# =============================================================================
# Entrypoint del contenedor backend.
#
# Aplica las migraciones de Prisma ANTES de arrancar el servidor. Es idempotente:
#   - BD nueva (tras terraform apply)  -> crea todas las tablas
#   - BD al día                        -> "No pending migrations", ~2s
#
# Con varias tareas arrancando a la vez, Prisma usa un advisory lock en la BD,
# así que solo una aplica las migraciones y las demás esperan. Es seguro.
#
# Si las migraciones fallan, el contenedor sale con código != 0 para que ECS
# lo detecte (circuit breaker + rollback) en lugar de servir una BD rota.
# =============================================================================
set -e

echo "[entrypoint] Aplicando migraciones de base de datos (prisma migrate deploy)..."

attempt=1
max_attempts=5
until node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[entrypoint] ERROR: las migraciones fallaron tras $max_attempts intentos. Abortando."
    exit 1
  fi
  echo "[entrypoint] migrate deploy falló (intento $attempt/$max_attempts). Reintentando en 5s..."
  attempt=$((attempt + 1))
  sleep 5
done

echo "[entrypoint] Migraciones al día. Arrancando servidor..."
exec "$@"
