# Conector local de SEAD-IESS a PostgreSQL

El navegador no puede conectarse directamente a una base de datos. Este pequeño servicio corre **en el mismo equipo** que la app, lee una tabla o vista con un usuario de **solo lectura** y entrega las filas al paso 1 («Datos → Base de datos»).

## 1. Preparar la base (lo hace el administrador)
Cree un usuario que solo pueda leer la vista de atenciones. Idealmente, la vista ya debe venir filtrada por periodo y diagnóstico:

```sql
CREATE ROLE lector_sead LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA clinica TO lector_sead;
GRANT SELECT ON clinica.v_atenciones_salud_mental TO lector_sead;
```

## 2. Iniciar el conector
```powershell
cd conector
npm install
$env:SEAD_PGHOST="127.0.0.1"; $env:SEAD_PGPORT="5432"; $env:SEAD_PGDATABASE="iess"
$env:SEAD_PGUSER="lector_sead"; $env:SEAD_PGPASSWORD="..."
npm start
```
Las variables disponibles están en `.env.ejemplo`. Por defecto acepta la app abierta con Live Server (`http://127.0.0.1:5500`). Si usa otra dirección, configure `SEAD_ORIGENES`.

Al iniciar, el conector muestra un **código de acceso**. Escríbalo en la app, en «Datos → Base de datos», junto con la dirección `http://127.0.0.1:8790`.

## Seguridad
- **Acceso:** solo escucha en `127.0.0.1` y rechaza otros nombres de host. Exige el código de acceso y solo responde a los orígenes permitidos.
- **Credenciales:** la contraseña de la base vive en este proceso y nunca llega al navegador.
- **Lectura:** solo lee tablas o vistas con permiso SELECT. No acepta SQL libre, usa transacciones de solo lectura, cancela las consultas a los 30 s y limita la lectura a `SEAD_MAX_FILAS` filas.
- **Registro:** la consola solo anota la tabla y la cantidad de filas, nunca los valores.
