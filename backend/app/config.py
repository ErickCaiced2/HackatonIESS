"""Configuración por variables de entorno. Ningún secreto vive en el código."""
from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Ajustes(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="IESS_", env_file=None, extra="ignore")

    entorno: str = Field("produccion", pattern="^(desarrollo|pruebas|produccion)$")
    database_url: str = ""  # usuario de la app: sin UPDATE ni DELETE en auditoría
    jwt_clave_archivo: Path = Path("/srv/claves/jwt_ed25519.pem")
    jwt_emisor: str = "iess-r2"
    jwt_audiencia: str = "iess-r2-api"
    acceso_minutos: int = Field(15, ge=1, le=60)
    renovacion_dias: int = Field(7, ge=1, le=30)
    max_fallos: int = Field(5, ge=3, le=10)
    bloqueo_minutos: int = Field(15, ge=1)
    intentos_por_minuto_ip: int = Field(10, ge=1)
    origenes_permitidos: list[str] = ["https://localhost"]

    @property
    def desarrollo(self) -> bool:
        return self.entorno == "desarrollo"
