#!/bin/sh
# Lo ejecuta PostgreSQL solo la primera vez: crea el rol de la aplicación, sin privilegios de dueño.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v rol="$IESS_DB_ROL_APP" -v clave="$IESS_DB_CLAVE_APP" -v db="$POSTGRES_DB" <<'SQL'
CREATE ROLE :"rol" LOGIN PASSWORD :'clave' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE :"db" TO :"rol";
GRANT USAGE ON SCHEMA public TO :"rol";
SQL
