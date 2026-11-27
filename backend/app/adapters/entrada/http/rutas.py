"""Rutas HTTP. Solo traducen: validan la entrada, llaman al caso de uso y arman la respuesta."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from app.adapters.entrada.http.proteccion import (
    COOKIE_ACCESO, COOKIE_RENOVACION, borrar_cookies, nuevo_csrf, poner_cookie, rechazo,
)
from app.application.errores import DatosInvalidos, SesionInvalida, SinPermiso
from app.domain.usuarios import EventoAuditoria, Rol, Usuario

router = APIRouter(prefix="/api")
TAMANOS_PAGINA = (10, 20, 50, 100)


def contenedor(request: Request):
    return request.app.state.contenedor


def ip_de(request: Request) -> str:
    return request.client.host if request.client else ""


def usuario_actual(request: Request) -> Usuario:
    return contenedor(request).autenticacion.usuario_de_token(request.cookies.get(COOKIE_ACCESO))


def requiere_rol(*roles: Rol):
    def dependencia(u: Annotated[Usuario, Depends(usuario_actual)], request: Request) -> Usuario:
        if u.rol not in roles:
            contenedor(request).auditoria.registrar(EventoAuditoria(
                "sesion", "Acceso denegado", "fallo", usuario=u.usuario, rol=u.rol.value, detalle=request.url.path, ip=ip_de(request)))
            raise SinPermiso()
        return u
    return dependencia


class Estricto(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class DatosInicio(Estricto):
    usuario: str = Field(min_length=1, max_length=60)
    contrasena: str = Field(min_length=1, max_length=128)
    modo: Literal["interno", "receptor"]


class DatosUsuario(Estricto):
    usuario: str = Field(min_length=3, max_length=60)
    nombre: str = Field(min_length=2, max_length=120)
    rol: Rol
    contrasena: str = Field(min_length=1, max_length=128)
    tipo_destinatario: Literal["msp", "iess"] | None = None


def _sesion_en_cookies(r: Response, s) -> dict:
    """Las cookies duran lo mismo que sus tokens; el CSRF se renueva con cada sesión."""
    ahora = datetime.now(UTC)
    poner_cookie(r, COOKIE_ACCESO, s.acceso, max_age=max(0, int((s.acceso_expira - ahora).total_seconds())))
    poner_cookie(r, COOKIE_RENOVACION, s.renovacion, max_age=max(0, int((s.renovacion_expira - ahora).total_seconds())))
    return {"usuario": s.usuario, "acceso_expira": s.acceso_expira.isoformat(), "csrf": nuevo_csrf(r)}


# ---------- Sesión ----------
@router.get("/auth/csrf")
def csrf(response: Response) -> dict:
    """Entrega el token CSRF (también en cookie). Se pide antes de iniciar sesión."""
    return {"csrf": nuevo_csrf(response)}


@router.post("/auth/iniciar")
def iniciar(datos: DatosInicio, request: Request, response: Response):
    c, ip = contenedor(request), ip_de(request)
    if not c.limitador.permitir("login:" + ip):
        c.auditoria.registrar(EventoAuditoria("sesion", "Demasiados intentos de inicio de sesión", "fallo", ip=ip))
        return rechazo(429, "Demasiados intentos. Espere un minuto e inténtelo de nuevo.")
    s = c.autenticacion.iniciar(datos.usuario, datos.contrasena, datos.modo, ip)
    return _sesion_en_cookies(response, s)


@router.post("/auth/renovar")
def renovar(request: Request, response: Response):
    c = contenedor(request)
    try:
        s = c.autenticacion.renovar(request.cookies.get(COOKIE_RENOVACION, ""), ip_de(request))
    except SesionInvalida as e:
        r = rechazo(401, e.mensaje)
        borrar_cookies(r)
        return r
    return _sesion_en_cookies(response, s)


@router.post("/auth/cerrar")
def cerrar(request: Request, response: Response) -> dict:
    c = contenedor(request)
    try:
        u = c.autenticacion.usuario_de_token(request.cookies.get(COOKIE_ACCESO))
    except SesionInvalida:
        u = None
    c.autenticacion.cerrar(request.cookies.get(COOKIE_RENOVACION), u, ip_de(request))
    borrar_cookies(response)
    return {"ok": True}


@router.get("/auth/yo")
def yo(u: Annotated[Usuario, Depends(usuario_actual)]) -> dict:
    return u.publico()


# ---------- Cuentas (solo TI; no hay autorregistro) ----------
@router.post("/usuarios", status_code=201)
def crear_usuario(datos: DatosUsuario, request: Request, actor: Annotated[Usuario, Depends(requiere_rol(Rol.TI))]) -> dict:
    u = contenedor(request).autenticacion.crear_usuario(actor, datos.usuario, datos.nombre, datos.rol, datos.contrasena,
                                                        datos.tipo_destinatario, ip_de(request))
    return u.publico()


@router.get("/usuarios")
def listar_usuarios(request: Request, _: Annotated[Usuario, Depends(requiere_rol(Rol.TI))]) -> list[dict]:
    return [u.publico() | {"activo": u.activo} for u in contenedor(request).autenticacion.listar_usuarios()]


# ---------- Auditoría (solo lectura) ----------
@router.get("/auditoria")
def auditoria(request: Request, _: Annotated[Usuario, Depends(requiere_rol(Rol.TI))],
              tipo: Literal["sesion", "usuarios", "peticion", "descarga", "error"] | None = None,
              pagina: Annotated[int, Query(ge=1)] = 1,
              por_pagina: Annotated[int, Query(ge=10, le=100)] = 10) -> dict:
    if por_pagina not in TAMANOS_PAGINA:
        raise DatosInvalidos(["Filas por página: 10, 20, 50 o 100."])
    filas, total = contenedor(request).auditoria.lista(tipo, por_pagina, (pagina - 1) * por_pagina)
    return {"filas": filas, "total": total, "pagina": pagina, "por_pagina": por_pagina}
