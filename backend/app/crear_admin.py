"""Crea una cuenta de TI desde el servidor (no por HTTP). Uso:
    docker compose exec api python -m app.crear_admin
La contraseña se pide sin mostrarla en pantalla y nunca se pasa como argumento.
"""
from __future__ import annotations

import getpass
import sys

from app.adapters.entrada.http.contenedor import contenedor_produccion
from app.application.errores import ErrorAplicacion
from app.config import Ajustes
from app.domain.usuarios import Rol


def main() -> int:
    c = contenedor_produccion(Ajustes())
    usuario = input("Usuario de TI (minúsculas, 3 a 40 caracteres): ").strip()
    nombre = input("Nombre visible: ").strip()
    contrasena = getpass.getpass("Contraseña (12 caracteres o más): ")
    if contrasena != getpass.getpass("Repita la contraseña: "):
        print("Las contraseñas no coinciden.", file=sys.stderr)
        return 1
    try:
        u = c.autenticacion.crear_usuario(None, usuario, nombre, Rol.TI, contrasena)
    except ErrorAplicacion as e:
        print(e.mensaje, file=sys.stderr)
        return 1
    print(f"Cuenta de TI creada: {u.usuario}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
