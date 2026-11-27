#!/bin/sh
# Arranque de la API: clave del JWT y servidor (las migraciones las corre el servicio «migrar»).
# Un solo proceso: el límite de intentos por IP vive en memoria.
set -eu
python -m app.generar_clave
exec uvicorn app.main:crear_app --factory --host 0.0.0.0 --port 8000 \
  --proxy-headers --forwarded-allow-ips="*" --no-server-header
