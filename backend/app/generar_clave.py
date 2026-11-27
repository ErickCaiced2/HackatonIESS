"""Genera la clave Ed25519 del JWT si todavía no existe. Se ejecuta al arrancar el contenedor."""
from app.adapters.salida.seguridad import generar_clave
from app.config import Ajustes

if __name__ == "__main__":
    generar_clave(Ajustes().jwt_clave_archivo)
