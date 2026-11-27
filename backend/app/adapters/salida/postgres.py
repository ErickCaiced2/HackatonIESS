"""Repositorios en PostgreSQL con SQLAlchemy 2. Las tablas las crea la migración de Alembic."""
from __future__ import annotations

import json
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, create_engine, func, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.domain.usuarios import EventoAuditoria, RegistroRenovacion, Rol, Usuario


class Base(DeclarativeBase):
    pass


class TablaUsuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    usuario: Mapped[str] = mapped_column(String(60), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    rol: Mapped[str] = mapped_column(String(20))
    tipo_destinatario: Mapped[str | None] = mapped_column(String(10), nullable=True)
    hash_contrasena: Mapped[str] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fallos: Mapped[int] = mapped_column(Integer, default=0)
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TablaRenovacion(Base):
    __tablename__ = "renovaciones"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    usuario_id: Mapped[str] = mapped_column(String(36))
    familia: Mapped[str] = mapped_column(String(36))
    huella: Mapped[str] = mapped_column(String(64), unique=True)
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    usado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revocado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TablaAuditoria(Base):
    __tablename__ = "auditoria"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    tipo: Mapped[str] = mapped_column(String(20))
    accion: Mapped[str] = mapped_column(String(120))
    resultado: Mapped[str] = mapped_column(String(10))
    usuario: Mapped[str] = mapped_column(String(60))
    rol: Mapped[str] = mapped_column(String(20))
    detalle: Mapped[str] = mapped_column(Text)
    referencia: Mapped[str] = mapped_column(String(60))
    ip: Mapped[str] = mapped_column(String(64))
    extra: Mapped[dict] = mapped_column(JSONB, default=dict)


def motor(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True, future=True)


def _a_usuario(f: TablaUsuario) -> Usuario:
    return Usuario(f.id, f.usuario, f.nombre, Rol(f.rol), f.hash_contrasena, f.tipo_destinatario,
                   f.activo, f.fallos, f.bloqueado_hasta, f.creado_en)


class RepoUsuariosPG:
    def __init__(self, sesiones: sessionmaker):
        self._s = sesiones

    def por_usuario(self, usuario: str) -> Usuario | None:
        with self._s() as s:
            f = s.scalar(select(TablaUsuario).where(TablaUsuario.usuario == usuario))
            return _a_usuario(f) if f else None

    def por_id(self, id_: str) -> Usuario | None:
        with self._s() as s:
            f = s.get(TablaUsuario, id_)
            return _a_usuario(f) if f else None

    def crear(self, u: Usuario) -> None:
        with self._s.begin() as s:
            s.add(TablaUsuario(id=u.id, usuario=u.usuario, nombre=u.nombre, rol=u.rol.value, tipo_destinatario=u.tipo_destinatario,
                               hash_contrasena=u.hash_contrasena, activo=u.activo, fallos=u.fallos, bloqueado_hasta=u.bloqueado_hasta))

    def actualizar(self, u: Usuario) -> None:
        with self._s.begin() as s:
            s.execute(update(TablaUsuario).where(TablaUsuario.id == u.id).values(
                nombre=u.nombre, hash_contrasena=u.hash_contrasena, activo=u.activo, fallos=u.fallos, bloqueado_hasta=u.bloqueado_hasta))

    def lista(self) -> list[Usuario]:
        with self._s() as s:
            return [_a_usuario(f) for f in s.scalars(select(TablaUsuario).order_by(TablaUsuario.creado_en))]


class RepoRenovacionesPG:
    def __init__(self, sesiones: sessionmaker):
        self._s = sesiones

    def crear(self, r: RegistroRenovacion) -> None:
        with self._s.begin() as s:
            s.add(TablaRenovacion(id=r.id, usuario_id=r.usuario_id, familia=r.familia, huella=r.huella,
                                  expira_en=r.expira_en, creado_en=r.creado_en))

    def por_huella(self, huella: str) -> RegistroRenovacion | None:
        with self._s() as s:
            f = s.scalar(select(TablaRenovacion).where(TablaRenovacion.huella == huella))
            return RegistroRenovacion(f.id, f.usuario_id, f.familia, f.huella, f.expira_en, f.creado_en, f.usado_en, f.revocado_en) if f else None

    def marcar_usado(self, id_: str, cuando: datetime) -> bool:
        # Condición atómica: si dos peticiones usan el mismo token a la vez, solo una gana.
        with self._s.begin() as s:
            r = s.execute(update(TablaRenovacion).where(TablaRenovacion.id == id_, TablaRenovacion.usado_en.is_(None)).values(usado_en=cuando))
            return r.rowcount == 1

    def revocar_familia(self, familia: str, cuando: datetime) -> None:
        with self._s.begin() as s:
            s.execute(update(TablaRenovacion).where(TablaRenovacion.familia == familia, TablaRenovacion.revocado_en.is_(None)).values(revocado_en=cuando))

    def revocar_usuario(self, usuario_id: str, cuando: datetime) -> None:
        with self._s.begin() as s:
            s.execute(update(TablaRenovacion).where(TablaRenovacion.usuario_id == usuario_id, TablaRenovacion.revocado_en.is_(None)).values(revocado_en=cuando))


class AuditoriaPG:
    def __init__(self, sesiones: sessionmaker):
        self._s = sesiones

    def registrar(self, e: EventoAuditoria) -> None:
        with self._s.begin() as s:
            s.add(TablaAuditoria(id=str(uuid.uuid4()), tipo=e.tipo, accion=e.accion[:120], resultado=e.resultado,
                                 usuario=e.usuario[:60], rol=e.rol, detalle=e.detalle[:2000], referencia=e.referencia[:60],
                                 ip=e.ip[:64], extra=json.loads(json.dumps(e.extra, default=str))))

    def lista(self, tipo: str | None, limite: int, desplazamiento: int) -> tuple[list[dict], int]:
        with self._s() as s:
            q = select(TablaAuditoria)
            cuenta = select(func.count()).select_from(TablaAuditoria)
            if tipo:
                q, cuenta = q.where(TablaAuditoria.tipo == tipo), cuenta.where(TablaAuditoria.tipo == tipo)
            filas = s.scalars(q.order_by(TablaAuditoria.fecha.desc()).limit(limite).offset(desplazamiento))
            campos = ("id", "fecha", "tipo", "accion", "resultado", "usuario", "rol", "detalle", "referencia")
            return [{c: getattr(f, c) for c in campos} for f in filas], s.scalar(cuenta) or 0
