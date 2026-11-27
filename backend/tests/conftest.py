"""Adaptadores en memoria para probar la aplicación sin base de datos (la ventaja de los puertos)."""
from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from argon2 import PasswordHasher
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient

from app.adapters.entrada.http.contenedor import Contenedor, politica
from app.adapters.entrada.http.proteccion import LimitadorVentana
from app.adapters.salida.seguridad import HasherArgon2, TokensJWT
from app.application.casos_uso.autenticacion import ServicioAutenticacion
from app.config import Ajustes
from app.domain.usuarios import Rol
from app.main import crear_app

CLAVE_FUERTE = "Tortuga-Galapagos-2026"


class Usuarios:
    def __init__(self):
        self.d = {}

    def por_usuario(self, usuario):
        return next((replace(u) for u in self.d.values() if u.usuario == usuario), None)

    def por_id(self, id_):
        return replace(self.d[id_]) if id_ in self.d else None

    def crear(self, u):
        self.d[u.id] = replace(u)

    def actualizar(self, u):
        self.d[u.id] = replace(u)

    def lista(self):
        return [replace(u) for u in self.d.values()]


class Renovaciones:
    def __init__(self):
        self.d = {}

    def crear(self, r):
        self.d[r.id] = replace(r)

    def por_huella(self, h):
        return next((replace(r) for r in self.d.values() if r.huella == h), None)

    def marcar_usado(self, id_, cuando):
        if self.d[id_].usado_en is not None:
            return False
        self.d[id_].usado_en = cuando
        return True

    def revocar_familia(self, familia, cuando):
        for r in self.d.values():
            if r.familia == familia and r.revocado_en is None:
                r.revocado_en = cuando

    def revocar_usuario(self, usuario_id, cuando):
        for r in self.d.values():
            if r.usuario_id == usuario_id:
                r.revocado_en = cuando


class Auditoria:
    def __init__(self):
        self.eventos = []

    def registrar(self, e):
        self.eventos.append(e)

    def lista(self, tipo, limite, desplazamiento):
        filas = [vars(e) for e in reversed(self.eventos) if not tipo or e.tipo == tipo]
        return filas[desplazamiento:desplazamiento + limite], len(filas)


class Reloj:
    def __init__(self):
        self.t = datetime.now(UTC)

    def ahora(self):
        return self.t

    def avanzar(self, **kw):
        self.t += timedelta(**kw)


@pytest.fixture
def entorno():
    ajustes = Ajustes(entorno="pruebas", origenes_permitidos=["https://testserver"])
    pem = Ed25519PrivateKey.generate().private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    tokens = TokensJWT(pem, ajustes.jwt_emisor, ajustes.jwt_audiencia, timedelta(minutes=15))
    reloj, auditoria = Reloj(), Auditoria()
    # Argon2id con costo bajo solo para que las pruebas sean rápidas.
    hasher = HasherArgon2(PasswordHasher(time_cost=1, memory_cost=8, parallelism=1))
    servicio = ServicioAutenticacion(Usuarios(), Renovaciones(), auditoria, hasher, tokens, reloj, politica(ajustes))
    c = Contenedor(ajustes, servicio, auditoria, LimitadorVentana(ajustes.intentos_por_minuto_ip))
    servicio.crear_usuario(None, "ti.admin", "TI de prueba", Rol.TI, CLAVE_FUERTE)
    servicio.crear_usuario(None, "comite", "Comité de prueba", Rol.COMITE, CLAVE_FUERTE)
    servicio.crear_usuario(None, "1720-2015-123456", "Doctor de prueba", Rol.RECEPTOR, CLAVE_FUERTE, "msp")
    cliente = TestClient(crear_app(c), base_url="https://testserver", raise_server_exceptions=False)
    return {"cliente": cliente, "c": c, "reloj": reloj, "auditoria": auditoria, "tokens": tokens, "pem": pem}


def csrf(cliente) -> dict:
    token = cliente.get("/api/auth/csrf").json()["csrf"]
    return {"X-CSRF-Token": token}


def entrar(cliente, usuario="ti.admin", contrasena=CLAVE_FUERTE, modo="interno"):
    return cliente.post("/api/auth/iniciar", json={"usuario": usuario, "contrasena": contrasena, "modo": modo}, headers=csrf(cliente))
