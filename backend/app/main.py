"""Aplicación FastAPI. `crear_app` recibe el contenedor para poder probar con adaptadores en memoria."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.adapters.entrada.http.contenedor import Contenedor, contenedor_produccion
from app.adapters.entrada.http.proteccion import crear_middleware, rechazo
from app.adapters.entrada.http.rutas import ip_de, router
from app.application.errores import DatosInvalidos, ErrorAplicacion
from app.config import Ajustes
from app.domain.usuarios import EventoAuditoria

log = logging.getLogger("iess")


def crear_app(c: Contenedor | None = None) -> FastAPI:
    c = c or contenedor_produccion(Ajustes())
    desarrollo = c.ajustes.desarrollo
    app = FastAPI(title="IESS R2 · Tus datos, tus derechos", docs_url="/api/docs" if desarrollo else None,
                  redoc_url=None, openapi_url="/api/openapi.json" if desarrollo else None)
    app.state.contenedor = c
    app.middleware("http")(crear_middleware(c.ajustes.origenes_permitidos))
    app.include_router(router)

    @app.exception_handler(ErrorAplicacion)
    async def error_aplicacion(_: Request, e: ErrorAplicacion):
        return rechazo(e.codigo, e.mensaje, errores=e.errores) if isinstance(e, DatosInvalidos) else rechazo(e.codigo, e.mensaje)

    @app.exception_handler(RequestValidationError)
    async def entrada_invalida(_: Request, e: RequestValidationError):
        # No se devuelve lo que se recibió (podría ser una contraseña): solo qué campo falló.
        campos = sorted({".".join(str(p) for p in err["loc"][1:]) or "cuerpo" for err in e.errors()})
        return rechazo(422, "Datos no válidos en: " + ", ".join(campos) + ".")

    @app.exception_handler(StarletteHTTPException)
    async def http(_: Request, e: StarletteHTTPException):
        return rechazo(e.status_code, "Recurso no encontrado." if e.status_code == 404 else "Petición no válida.")

    @app.exception_handler(Exception)
    async def inesperado(request: Request, e: Exception):
        log.exception("Error no controlado en %s", request.url.path)
        try:
            c.auditoria.registrar(EventoAuditoria("error", "Error interno", "fallo", detalle=f"{request.method} {request.url.path} · {type(e).__name__}", ip=ip_de(request)))
        except Exception:  # la auditoría no debe ocultar el error original
            log.exception("No se pudo registrar el error en la auditoría")
        return rechazo(500, "Ocurrió un error interno. Quedó registrado para TI.")

    return app
