"""Casos de uso de cuentas y sesiones: iniciar, renovar, cerrar y crear usuarios."""
from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import timedelta

from app.application.errores import Conflicto, CredencialesInvalidas, DatosInvalidos, SesionInvalida, SinPermiso
from app.application.puertos import Auditoria, Hasher, RepoRenovaciones, RepoUsuarios, Reloj, Tokens
from app.domain.usuarios import (
    EventoAuditoria, RegistroRenovacion, Rol, Usuario, normalizar_usuario, validar_contrasena, validar_cuenta,
)


@dataclass(frozen=True)
class Politica:
    max_fallos: int = 5
    bloqueo: timedelta = timedelta(minutes=15)
    renovacion: timedelta = timedelta(days=7)


@dataclass(frozen=True)
class SesionEmitida:
    acceso: str
    acceso_expira: object
    renovacion: str
    renovacion_expira: object
    usuario: dict


ROLES_POR_MODO = {"interno": {Rol.TI, Rol.COMITE}, "receptor": {Rol.RECEPTOR}}


def huella(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class ServicioAutenticacion:
    def __init__(self, usuarios: RepoUsuarios, renovaciones: RepoRenovaciones, auditoria: Auditoria,
                 hasher: Hasher, tokens: Tokens, reloj: Reloj, politica: Politica = Politica()):
        self.usuarios, self.renovaciones, self.auditoria = usuarios, renovaciones, auditoria
        self.hasher, self.tokens, self.reloj, self.politica = hasher, tokens, reloj, politica
        # Hash señuelo: un usuario inexistente cuesta lo mismo que una contraseña errónea.
        self._senuelo = hasher.hash(secrets.token_urlsafe(24))

    # ---------- Inicio de sesión ----------
    def iniciar(self, usuario_texto: str, contrasena: str, modo: str, ip: str = "") -> SesionEmitida:
        ahora = self.reloj.ahora()
        nombre = normalizar_usuario(usuario_texto)
        u = self.usuarios.por_usuario(nombre)
        valida = self.hasher.verificar(u.hash_contrasena if u else self._senuelo, contrasena)
        motivo = ""
        if u is None:
            motivo = "usuario inexistente"
        elif not u.activo:
            motivo = "cuenta desactivada"
        elif u.bloqueado(ahora):
            motivo = "cuenta bloqueada"
        elif not valida:
            motivo = "contraseña incorrecta"
        elif u.rol not in ROLES_POR_MODO.get(modo, set()):
            motivo = "rol no permitido en este acceso"

        if motivo:
            if u is not None and motivo == "contraseña incorrecta":
                u.fallos += 1
                if u.fallos >= self.politica.max_fallos:
                    u.fallos, u.bloqueado_hasta = 0, ahora + self.politica.bloqueo
                    motivo += "; cuenta bloqueada temporalmente"
                self.usuarios.actualizar(u)
            # El usuario escrito solo se registra si existe: un usuario inexistente puede ser una contraseña tecleada por error.
            self.auditoria.registrar(EventoAuditoria("sesion", "Inicio de sesión fallido", "fallo",
                                                     usuario=u.usuario if u else "(desconocido)", detalle=motivo, ip=ip))
            raise CredencialesInvalidas()

        u.fallos, u.bloqueado_hasta = 0, None
        if self.hasher.necesita_rehash(u.hash_contrasena):
            u.hash_contrasena = self.hasher.hash(contrasena)
        self.usuarios.actualizar(u)
        sesion = self._emitir(u, familia=str(uuid.uuid4()))
        self.auditoria.registrar(EventoAuditoria("sesion", "Inicio de sesión", usuario=u.usuario, rol=u.rol.value, ip=ip))
        return sesion

    def _emitir(self, u: Usuario, familia: str) -> SesionEmitida:
        ahora = self.reloj.ahora()
        acceso, acceso_expira = self.tokens.emitir_acceso(u, ahora)
        renovacion = secrets.token_urlsafe(32)
        expira = ahora + self.politica.renovacion
        self.renovaciones.crear(RegistroRenovacion(str(uuid.uuid4()), u.id, familia, huella(renovacion), expira, ahora))
        return SesionEmitida(acceso, acceso_expira, renovacion, expira, u.publico())

    # ---------- Renovación con rotación y detección de reutilización ----------
    def renovar(self, renovacion: str, ip: str = "") -> SesionEmitida:
        ahora = self.reloj.ahora()
        r = self.renovaciones.por_huella(huella(renovacion or ""))
        if r is None or r.revocado_en is not None or r.expira_en <= ahora:
            raise SesionInvalida()
        if r.usado_en is not None or not self.renovaciones.marcar_usado(r.id, ahora):
            # Un token ya usado vuelve a aparecer: posible robo. Se cierra toda la cadena.
            self.renovaciones.revocar_familia(r.familia, ahora)
            u = self.usuarios.por_id(r.usuario_id)
            self.auditoria.registrar(EventoAuditoria("sesion", "Reutilización de token de renovación", "fallo",
                                                     usuario=u.usuario if u else "", detalle="Se revocaron todas las sesiones de esa cadena", ip=ip))
            raise SesionInvalida()
        u = self.usuarios.por_id(r.usuario_id)
        if u is None or not u.activo or u.bloqueado(ahora):
            self.renovaciones.revocar_familia(r.familia, ahora)
            raise SesionInvalida()
        return self._emitir(u, r.familia)

    def cerrar(self, renovacion: str | None, usuario: Usuario | None, ip: str = "") -> None:
        ahora = self.reloj.ahora()
        r = self.renovaciones.por_huella(huella(renovacion)) if renovacion else None
        if r is not None:
            self.renovaciones.revocar_familia(r.familia, ahora)
        if usuario is not None:
            self.auditoria.registrar(EventoAuditoria("sesion", "Cierre de sesión", usuario=usuario.usuario, rol=usuario.rol.value, ip=ip))

    # ---------- Cuentas ----------
    def crear_usuario(self, actor: Usuario | None, usuario: str, nombre: str, rol: Rol, contrasena: str,
                      tipo_destinatario: str | None = None, ip: str = "") -> Usuario:
        """actor=None solo desde el comando de arranque (acceso al servidor), nunca desde HTTP."""
        if actor is not None and actor.rol is not Rol.TI:
            raise SinPermiso()
        nombre_usuario = normalizar_usuario(usuario)
        errores = validar_cuenta(nombre_usuario, rol, tipo_destinatario, nombre) + validar_contrasena(contrasena, nombre_usuario)
        if errores:
            raise DatosInvalidos(errores)
        if self.usuarios.por_usuario(nombre_usuario) is not None:
            raise Conflicto("Ya existe una cuenta con ese usuario.")
        u = Usuario(str(uuid.uuid4()), nombre_usuario, nombre.strip(), rol, self.hasher.hash(contrasena),
                    tipo_destinatario if rol is Rol.RECEPTOR else None, creado_en=self.reloj.ahora())
        self.usuarios.crear(u)
        self.auditoria.registrar(EventoAuditoria("usuarios", "Cuenta creada", usuario=actor.usuario if actor else "(arranque)",
                                                 rol=actor.rol.value if actor else "", detalle=f"{u.usuario} · {rol.value}", ip=ip))
        return u

    def listar_usuarios(self) -> list[Usuario]:
        return self.usuarios.lista()

    def usuario_de_token(self, acceso: str | None) -> Usuario:
        if not acceso:
            raise SesionInvalida()
        reclamos = self.tokens.verificar_acceso(acceso)
        u = self.usuarios.por_id(reclamos.usuario_id)
        # El rol del token debe seguir siendo el de la cuenta (por si cambió o se desactivó).
        if u is None or not u.activo or u.rol is not reclamos.rol or u.bloqueado(self.reloj.ahora()):
            raise SesionInvalida()
        return u
