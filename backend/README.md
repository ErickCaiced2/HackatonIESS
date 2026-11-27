# Backend · FastAPI con arquitectura hexagonal

Todo corre en este equipo con Docker: **los datos no salen del evento**.

```
app/domain/        reglas puras (usuarios, identificadores, contraseñas)
app/application/   casos de uso y puertos (interfaces)
app/adapters/      entrada HTTP (FastAPI) y salida (PostgreSQL, Argon2id, JWT Ed25519)
migraciones/       Alembic (tablas, auditoría inmutable, permisos del rol de la app)
```

## Poner en marcha
1. Copie `.env.example` como `.env` en la raíz y cambie las dos claves.
2. `docker compose up -d --build`
3. Cree la primera cuenta de TI (la contraseña se pide sin mostrarse):
   `docker compose exec api python -m app.crear_admin`
4. La API queda en `https://localhost/api`. El resto de rutas va a Next.js en el puerto 3000 de este equipo (`npm run dev`).
   El certificado es de la CA interna de Caddy: el navegador lo marcará como no confiable hasta instalarla.

## Pruebas
- Con adaptadores en memoria: `docker compose run --rm --no-deps --entrypoint pytest api -q` (requiere `IESS_DEV=1` al construir).
- La prueba de auditoría inmutable necesita PostgreSQL y la variable `IESS_DATABASE_URL_DUENO`.

## Seguridad implementada
- **Contraseñas:** Argon2id, mínimo 12 caracteres, sin contraseñas comunes ni el usuario dentro.
- **Sin autorregistro:** solo TI crea cuentas (`POST /api/usuarios`); la primera, por consola.
- **Inicio de sesión:** mismo mensaje para cualquier fallo, hash señuelo, bloqueo de 15 min tras 5 fallos y 10 intentos por minuto por IP.
- **JWT:** EdDSA (Ed25519), 15 min, con `iss`, `aud`, `sub`, `rol`, `jti`, `iat` y `nbf`. Solo se acepta ese algoritmo.
- **Renovación:** token opaco de 7 días guardado como SHA-256, rotación en cada uso y revocación de toda la cadena si se reutiliza.
- **Cookies:** `__Host-` con `HttpOnly`, `Secure`, `SameSite=Strict`; CSRF de doble envío y control de `Origin`/`Sec-Fetch-Site`.
- **Roles:** cada ruta declara quién puede usarla; los accesos denegados quedan en la auditoría.
- **Auditoría:** solo inserción (trigger de PostgreSQL) y el rol `iess_app` no tiene `UPDATE` ni `DELETE`.
- **Contenedores:** la API corre sin root, con sistema de archivos de solo lectura y sin capacidades; las migraciones usan otra credencial que la API no recibe. Solo Caddy publica el puerto 443 en `127.0.0.1`.

Pendiente (fases 2 a 5): validación del CSV y del PDF, motor de anonimización en Pandas con PyCANON, peticiones, PTA con ReportLab y conexión del frontend.
