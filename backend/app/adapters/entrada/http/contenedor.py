"""Raíz de composición: conecta los casos de uso con los adaptadores concretos."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.orm import sessionmaker

from app.adapters.entrada.http.proteccion import LimitadorVentana
from app.adapters.salida.postgres import AuditoriaPG, RepoRenovacionesPG, RepoUsuariosPG, motor
from app.adapters.salida.seguridad import HasherArgon2, RelojSistema, TokensJWT
from app.application.casos_uso.autenticacion import Politica, ServicioAutenticacion
from app.application.puertos import Auditoria
from app.config import Ajustes


@dataclass
class Contenedor:
    ajustes: Ajustes
    autenticacion: ServicioAutenticacion
    auditoria: Auditoria
    limitador: LimitadorVentana


def politica(a: Ajustes) -> Politica:
    return Politica(a.max_fallos, timedelta(minutes=a.bloqueo_minutos), timedelta(days=a.renovacion_dias))


def contenedor_produccion(a: Ajustes) -> Contenedor:
    if not a.database_url:
        raise RuntimeError("Falta IESS_DATABASE_URL.")
    sesiones = sessionmaker(motor(a.database_url), expire_on_commit=False)
    auditoria = AuditoriaPG(sesiones)
    tokens = TokensJWT(a.jwt_clave_archivo.read_bytes(), a.jwt_emisor, a.jwt_audiencia, timedelta(minutes=a.acceso_minutos))
    servicio = ServicioAutenticacion(RepoUsuariosPG(sesiones), RepoRenovacionesPG(sesiones), auditoria,
                                     HasherArgon2(), tokens, RelojSistema(), politica(a))
    return Contenedor(a, servicio, auditoria, LimitadorVentana(a.intentos_por_minuto_ip))
