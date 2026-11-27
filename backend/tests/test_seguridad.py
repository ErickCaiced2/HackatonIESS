"""Pruebas de seguridad de cuentas y sesiones. Todas las cuentas y claves son inventadas."""
import os
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.domain.usuarios import normalizar_usuario, validar_contrasena
from tests.conftest import CLAVE_FUERTE, csrf, entrar

MENSAJE = "Usuario o contraseña incorrectos, o la cuenta está bloqueada temporalmente."


def cabeceras_cookie(r):
    return {c.split("=", 1)[0]: c for c in r.headers.get_list("set-cookie")}


def test_iniciar_sesion_pone_cookies_seguras(entorno):
    r = entrar(entorno["cliente"])
    assert r.status_code == 200, r.text
    assert r.json()["usuario"]["rol"] == "ti"
    cookies = cabeceras_cookie(r)
    for nombre in ("__Host-acceso", "__Host-renovacion"):
        c = cookies[nombre].lower()
        assert "httponly" in c and "secure" in c and "samesite=strict" in c and "path=/" in c and "domain" not in c
    assert "httponly" not in cookies["__Host-csrf"].lower()
    # El token no viaja en el cuerpo: solo en la cookie HttpOnly.
    assert "acceso" not in r.json() or "." not in str(r.json().get("acceso", ""))


def test_sin_csrf_o_con_otro_origen_se_rechaza(entorno):
    cl = entorno["cliente"]
    cuerpo = {"usuario": "ti.admin", "contrasena": CLAVE_FUERTE, "modo": "interno"}
    assert cl.post("/api/auth/iniciar", json=cuerpo).status_code == 403
    assert cl.post("/api/auth/iniciar", json=cuerpo, headers={"X-CSRF-Token": "inventado"}).status_code == 403
    h = csrf(cl) | {"Origin": "https://sitio-ajeno.example"}
    assert cl.post("/api/auth/iniciar", json=cuerpo, headers=h).status_code == 403
    h = csrf(cl) | {"Sec-Fetch-Site": "cross-site"}
    assert cl.post("/api/auth/iniciar", json=cuerpo, headers=h).status_code == 403


def test_mismo_mensaje_para_usuario_inexistente_clave_erronea_y_rol_ajeno(entorno):
    cl = entorno["cliente"]
    respuestas = [entrar(cl, "no.existe"), entrar(cl, contrasena="otra-clave-larga-1"),
                  entrar(cl, "1720-2015-123456", modo="interno"), entrar(cl, "ti.admin", modo="receptor")]
    assert {(r.status_code, r.json()["error"]) for r in respuestas} == {(401, MENSAJE)}


def test_bloqueo_tras_cinco_fallos_y_desbloqueo_por_tiempo(entorno):
    cl, reloj = entorno["cliente"], entorno["reloj"]
    entorno["c"].limitador.maximo = 100  # aquí se prueba el bloqueo por cuenta, no por IP
    for _ in range(5):
        assert entrar(cl, contrasena="clave-erronea-123").status_code == 401
    assert entrar(cl).status_code == 401  # bloqueada aunque la clave sea correcta
    reloj.avanzar(minutes=16)
    assert entrar(cl).status_code == 200
    detalles = [e.detalle for e in entorno["auditoria"].eventos]
    assert any("bloqueada temporalmente" in d for d in detalles)


def test_limite_de_intentos_por_ip(entorno):
    cl = entorno["cliente"]
    codigos = [entrar(cl, "no.existe").status_code for _ in range(11)]
    assert codigos[:10] == [401] * 10 and codigos[10] == 429


def test_tokens_alterados_vencidos_o_con_otro_algoritmo(entorno):
    cl, tokens = entorno["cliente"], entorno["tokens"]
    entrar(cl)
    assert cl.get("/api/auth/yo").json()["usuario"] == "ti.admin"
    valido = cl.cookies.get("__Host-acceso")
    u = entorno["c"].autenticacion.usuarios.por_usuario("ti.admin")
    vencido, _ = tokens.emitir_acceso(u, datetime.now(UTC) - timedelta(hours=1))
    reclamos = jwt.decode(valido, options={"verify_signature": False})
    falsos = [
        valido[:-3] + ("AAA" if not valido.endswith("AAA") else "BBB"),
        vencido,
        jwt.encode(reclamos | {"rol": "ti"}, "secreto-adivinado", algorithm="HS256"),
        jwt.encode(reclamos, None, algorithm="none") if "none" in jwt.algorithms.get_default_algorithms() else "x.y.z",
        jwt.encode(reclamos | {"aud": "otra-app"}, entorno["pem"], algorithm="EdDSA"),
    ]
    cl.cookies.clear()
    for t in falsos:
        assert cl.get("/api/auth/yo", cookies={"__Host-acceso": t}).status_code == 401


def test_renovacion_rota_y_detecta_reutilizacion(entorno):
    cl = entorno["cliente"]
    entrar(cl)
    viejo = cl.cookies.get("__Host-renovacion")
    h = {"X-CSRF-Token": cl.cookies.get("__Host-csrf")}
    r = cl.post("/api/auth/renovar", headers=h)
    assert r.status_code == 200
    nuevo = cl.cookies.get("__Host-renovacion")
    assert nuevo != viejo
    # Alguien reutiliza el token viejo: se revoca toda la cadena, incluido el nuevo.
    h = {"X-CSRF-Token": cl.cookies.get("__Host-csrf")}
    assert cl.post("/api/auth/renovar", headers=h, cookies={"__Host-renovacion": viejo}).status_code == 401
    assert cl.post("/api/auth/renovar", headers=h, cookies={"__Host-renovacion": nuevo}).status_code == 401
    assert any(e.accion == "Reutilización de token de renovación" for e in entorno["auditoria"].eventos)


def test_cerrar_sesion_revoca_la_renovacion(entorno):
    cl = entorno["cliente"]
    entrar(cl)
    renovacion = cl.cookies.get("__Host-renovacion")
    h = {"X-CSRF-Token": cl.cookies.get("__Host-csrf")}
    assert cl.post("/api/auth/cerrar", headers=h).status_code == 200
    assert cl.post("/api/auth/renovar", headers=h, cookies={"__Host-renovacion": renovacion}).status_code == 401


def test_solo_ti_crea_cuentas_y_con_reglas(entorno):
    cl = entorno["cliente"]
    nuevo = {"usuario": "IESS-0002", "nombre": "Personal autorizado", "rol": "receptor",
             "contrasena": "Volcan-Cotopaxi-5897", "tipo_destinatario": "iess"}
    entrar(cl, "comite")
    h = {"X-CSRF-Token": cl.cookies.get("__Host-csrf")}
    assert cl.post("/api/usuarios", json=nuevo, headers=h).status_code == 403
    assert any(e.accion == "Acceso denegado" for e in entorno["auditoria"].eventos)

    entrar(cl)
    h = {"X-CSRF-Token": cl.cookies.get("__Host-csrf")}
    assert cl.post("/api/usuarios", json=nuevo, headers=h).status_code == 201
    assert cl.post("/api/usuarios", json=nuevo, headers=h).status_code == 409
    debil = nuevo | {"usuario": "IESS-0003", "contrasena": "123456789012"}
    r = cl.post("/api/usuarios", json=debil, headers=h)
    assert r.status_code == 422 and "común" in r.json()["error"]
    mala = nuevo | {"usuario": "1720-15-1", "tipo_destinatario": "msp"}
    assert cl.post("/api/usuarios", json=mala, headers=h).status_code == 422
    # El rol no se puede ascender por el cuerpo de la petición.
    extra = nuevo | {"usuario": "IESS-0004", "es_admin": True}
    assert cl.post("/api/usuarios", json=extra, headers=h).status_code == 422
    # Y se puede entrar con la cuenta nueva por el acceso de receptores.
    assert entrar(cl, "iess-0002", "Volcan-Cotopaxi-5897", "receptor").status_code == 200


def test_errores_de_validacion_no_repiten_la_contrasena(entorno):
    cl = entorno["cliente"]
    secreta = "S" * 200
    r = cl.post("/api/auth/iniciar", json={"usuario": "ti.admin", "contrasena": secreta, "modo": "interno"}, headers=csrf(cl))
    assert r.status_code == 422 and secreta not in r.text and "contrasena" in r.text


def test_cabeceras_de_seguridad_y_sin_documentacion_publica(entorno):
    cl = entorno["cliente"]
    r = cl.get("/api/auth/csrf")
    for c in ("x-content-type-options", "x-frame-options", "content-security-policy", "referrer-policy", "cache-control"):
        assert c in r.headers
    assert cl.get("/api/docs").status_code == 404
    assert cl.get("/api/openapi.json").status_code == 404


def test_la_auditoria_no_guarda_contrasenas_y_solo_ti_la_lee(entorno):
    cl = entorno["cliente"]
    entrar(cl, contrasena="Clave-Equivocada-999")
    entrar(cl, "Clave-Tecleada-En-Usuario-1")
    entrar(cl, "comite")
    assert cl.get("/api/auditoria").status_code == 403
    entrar(cl)
    r = cl.get("/api/auditoria", params={"por_pagina": 20})
    assert r.status_code == 200 and r.json()["total"] >= 4
    assert cl.get("/api/auditoria", params={"por_pagina": 7}).status_code == 422
    texto = repr(entorno["auditoria"].eventos)
    assert CLAVE_FUERTE not in texto and "Clave-Equivocada-999" not in texto and "Clave-Tecleada" not in texto.replace("(desconocido)", "")


def test_reglas_de_dominio():
    assert normalizar_usuario(" iess-0002 ") == "IESS-0002"
    assert normalizar_usuario(" TI.Admin ") == "ti.admin"
    assert validar_contrasena("corta")
    assert validar_contrasena("aaaaaaaaaaaaaa")
    assert validar_contrasena("ti.admin-2026-xyz", "ti.admin")
    assert validar_contrasena(CLAVE_FUERTE) == []


@pytest.mark.skipif(not os.environ.get("IESS_DATABASE_URL_DUENO"), reason="Necesita PostgreSQL (docker compose)")
def test_postgres_auditoria_inmutable():
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import DBAPIError
    for url_var in ("IESS_DATABASE_URL", "IESS_DATABASE_URL_DUENO"):
        motor = create_engine(os.environ[url_var])
        with motor.begin() as c:
            c.execute(text("INSERT INTO auditoria (id, tipo, accion, resultado) VALUES (gen_random_uuid()::text, 'error', 'prueba', 'ok')"))
        for sentencia in ("UPDATE auditoria SET accion = 'x'", "DELETE FROM auditoria", "TRUNCATE auditoria"):
            with pytest.raises(DBAPIError), motor.begin() as c:
                c.execute(text(sentencia))
