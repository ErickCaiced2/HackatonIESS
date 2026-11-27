"""Protecciones transversales: cabeceras de seguridad, CSRF de doble envío, origen y límite de intentos."""
from __future__ import annotations

import hmac
import secrets
import threading
import time
from collections import defaultdict, deque

from fastapi import Request, Response
from fastapi.responses import JSONResponse

COOKIE_ACCESO = "__Host-acceso"
COOKIE_RENOVACION = "__Host-renovacion"
COOKIE_CSRF = "__Host-csrf"
CABECERA_CSRF = "X-CSRF-Token"
METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}

CABECERAS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


def poner_cookie(r: Response, nombre: str, valor: str, max_age: int, http_only: bool = True) -> None:
    # El prefijo __Host- obliga a Secure, Path=/ y sin Domain: la cookie no se comparte con subdominios.
    r.set_cookie(nombre, valor, max_age=max_age, path="/", secure=True, httponly=http_only, samesite="strict")


def borrar_cookies(r: Response) -> None:
    for nombre in (COOKIE_ACCESO, COOKIE_RENOVACION):
        r.delete_cookie(nombre, path="/", secure=True, httponly=True, samesite="strict")


def nuevo_csrf(r: Response) -> str:
    token = secrets.token_urlsafe(32)
    poner_cookie(r, COOKIE_CSRF, token, max_age=8 * 3600, http_only=False)  # el frontend la lee y la reenvía en la cabecera
    return token


def rechazo(codigo: int, mensaje: str, **extra) -> JSONResponse:
    return JSONResponse({"error": mensaje, **extra}, status_code=codigo, headers=CABECERAS)


def crear_middleware(origenes_permitidos: list[str]):
    async def middleware(request: Request, call_next):
        if request.method not in METODOS_SEGUROS:
            origen = request.headers.get("origin")
            if origen is not None and origen not in origenes_permitidos:
                return rechazo(403, "Origen no permitido.")
            if request.headers.get("sec-fetch-site") not in (None, "same-origin", "none"):
                return rechazo(403, "Petición entre sitios no permitida.")
            cookie, cabecera = request.cookies.get(COOKIE_CSRF, ""), request.headers.get(CABECERA_CSRF, "")
            if not cookie or not cabecera or not hmac.compare_digest(cookie, cabecera):
                return rechazo(403, "Falta o no coincide el token CSRF. Recargue la página.")
        respuesta = await call_next(request)
        for k, v in CABECERAS.items():
            respuesta.headers.setdefault(k, v)
        return respuesta
    return middleware


class LimitadorVentana:
    """Ventana deslizante en memoria (un solo proceso de la API). El bloqueo por cuenta vive en la base de datos."""

    def __init__(self, maximo: int, segundos: float = 60.0, reloj=time.monotonic):
        self.maximo, self.segundos, self.reloj = maximo, segundos, reloj
        self._eventos: dict[str, deque] = defaultdict(deque)
        self._candado = threading.Lock()

    def permitir(self, clave: str) -> bool:
        ahora = self.reloj()
        with self._candado:
            cola = self._eventos[clave]
            while cola and cola[0] <= ahora - self.segundos:
                cola.popleft()
            if len(cola) >= self.maximo:
                return False
            cola.append(ahora)
            return True
