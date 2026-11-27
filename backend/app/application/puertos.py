"""Puertos: lo que la aplicación necesita del exterior. Los adaptadores los implementan."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.domain.usuarios import EventoAuditoria, RegistroRenovacion, Rol, Usuario


class RepoUsuarios(Protocol):
    def por_usuario(self, usuario: str) -> Usuario | None: ...
    def por_id(self, id_: str) -> Usuario | None: ...
    def crear(self, u: Usuario) -> None: ...
    def actualizar(self, u: Usuario) -> None: ...
    def lista(self) -> list[Usuario]: ...


class RepoRenovaciones(Protocol):
    def crear(self, r: RegistroRenovacion) -> None: ...
    def por_huella(self, huella: str) -> RegistroRenovacion | None: ...
    def marcar_usado(self, id_: str, cuando: datetime) -> bool:
        """Devuelve False si ya estaba usado (otra petición lo ganó)."""
    def revocar_familia(self, familia: str, cuando: datetime) -> None: ...
    def revocar_usuario(self, usuario_id: str, cuando: datetime) -> None: ...


class Auditoria(Protocol):
    def registrar(self, e: EventoAuditoria) -> None: ...
    def lista(self, tipo: str | None, limite: int, desplazamiento: int) -> tuple[list[dict], int]: ...


class Hasher(Protocol):
    def hash(self, contrasena: str) -> str: ...
    def verificar(self, hash_: str, contrasena: str) -> bool: ...
    def necesita_rehash(self, hash_: str) -> bool: ...


@dataclass(frozen=True)
class Reclamos:
    usuario_id: str
    rol: Rol
    jti: str
    expira_en: datetime


class Tokens(Protocol):
    def emitir_acceso(self, u: Usuario, ahora: datetime) -> tuple[str, datetime]: ...
    def verificar_acceso(self, token: str) -> Reclamos:
        """Lanza TokenInvalido si la firma, el algoritmo, el emisor, la audiencia o la fecha no son válidos."""


class Reloj(Protocol):
    def ahora(self) -> datetime: ...
