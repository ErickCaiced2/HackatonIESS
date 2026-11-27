"""Reglas de usuarios, identificadores y contraseñas. Python puro: no conoce HTTP ni base de datos."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class Rol(StrEnum):
    TI = "ti"
    COMITE = "ce"
    RECEPTOR = "receptor"


NOMBRES_ROL = {
    Rol.TI: "Tecnologías de la información (TI)",
    Rol.COMITE: "Comité de ética",
    Rol.RECEPTOR: "Doctor o personal autorizado",
}

# Igual que src/motor/destinatario.js.
FORMATOS_DESTINATARIO = {
    "msp": (re.compile(r"^\d{4}-\d{4}-\d{6}$"), "la licencia del MSP tiene el formato 0000-0000-000000"),
    "iess": (re.compile(r"^IESS-\d{4,6}$"), "el identificador del IESS es IESS- seguido de 4 a 6 dígitos"),
}
USUARIO_INTERNO = re.compile(r"^[a-z][a-z0-9._-]{2,39}$")
_PARECE_RECEPTOR = re.compile(r"^(IESS-|\d)", re.IGNORECASE)

CONTRASENA_MIN = 12
CONTRASENA_MAX = 128
# Lista corta de contraseñas frecuentes; se compara sin mayúsculas ni espacios.
_COMUNES = {
    "123456789012", "contraseña123", "contrasena123", "password1234", "qwertyuiop12", "administrador",
    "iess12345678", "iessiessiess", "aaaaaaaaaaaa", "000000000000", "111111111111", "123412341234",
    "ecuador12345", "ecuador2026!", "quito1234567", "guayaquil123", "bienvenido123", "cambiame1234",
    "abc123abc123", "qwerty123456", "passw0rd1234", "1q2w3e4r5t6y", "admin1234567", "iloveyou1234",
}


def normalizar_id(texto: object) -> str:
    return str(texto or "").strip().upper()


def normalizar_usuario(texto: object) -> str:
    """Las licencias y los identificadores del IESS se escriben en mayúsculas; los internos, en minúsculas."""
    t = str(texto or "").strip()
    return normalizar_id(t) if _PARECE_RECEPTOR.match(t) else t.lower()


def validar_destinatario(tipo: str | None, identificador: object) -> str:
    if tipo not in FORMATOS_DESTINATARIO:
        return "Elija el tipo de destinatario."
    patron, texto = FORMATOS_DESTINATARIO[tipo]
    i = normalizar_id(identificador)
    if not i:
        return "Escriba el identificador del destinatario."
    return "" if patron.match(i) else f"Identificador no válido: {texto}."


def validar_contrasena(contrasena: str, usuario: str = "") -> list[str]:
    errores = []
    if len(contrasena) < CONTRASENA_MIN:
        errores.append(f"La contraseña debe tener al menos {CONTRASENA_MIN} caracteres.")
    if len(contrasena) > CONTRASENA_MAX:
        errores.append(f"La contraseña no puede superar {CONTRASENA_MAX} caracteres.")
    compacta = re.sub(r"\s+", "", contrasena.lower())
    if compacta in _COMUNES or len(set(compacta)) <= 3:
        errores.append("La contraseña es demasiado común o repetitiva.")
    if usuario and usuario.lower().replace("-", "") in compacta.replace("-", ""):
        errores.append("La contraseña no puede contener el usuario.")
    return errores


def validar_cuenta(usuario: str, rol: Rol, tipo_destinatario: str | None, nombre: str) -> list[str]:
    errores = []
    if not 2 <= len(nombre.strip()) <= 120:
        errores.append("El nombre debe tener entre 2 y 120 caracteres.")
    if rol is Rol.RECEPTOR:
        e = validar_destinatario(tipo_destinatario, usuario)
        if e:
            errores.append(e)
    elif tipo_destinatario is not None:
        errores.append("Solo el doctor o personal autorizado tiene tipo de destinatario.")
    elif not USUARIO_INTERNO.match(usuario):
        errores.append("El usuario interno debe tener de 3 a 40 caracteres: minúsculas, números, punto, guion o guion bajo.")
    return errores


@dataclass
class Usuario:
    id: str
    usuario: str
    nombre: str
    rol: Rol
    hash_contrasena: str
    tipo_destinatario: str | None = None
    activo: bool = True
    fallos: int = 0
    bloqueado_hasta: datetime | None = None
    creado_en: datetime | None = None

    def bloqueado(self, ahora: datetime) -> bool:
        return self.bloqueado_hasta is not None and self.bloqueado_hasta > ahora

    def publico(self) -> dict:
        datos = {"id": self.id, "usuario": self.usuario, "nombre": self.nombre, "rol": self.rol.value}
        if self.rol is Rol.RECEPTOR:
            datos["destinatario"] = {"tipo": self.tipo_destinatario, "id": self.usuario}
        return datos


@dataclass
class RegistroRenovacion:
    """Token de renovación: solo se guarda su huella SHA-256."""
    id: str
    usuario_id: str
    familia: str
    huella: str
    expira_en: datetime
    creado_en: datetime
    usado_en: datetime | None = None
    revocado_en: datetime | None = None


@dataclass
class EventoAuditoria:
    tipo: str  # sesion, usuarios, peticion, descarga, error
    accion: str
    resultado: str = "ok"  # ok | fallo
    usuario: str = ""
    rol: str = ""
    detalle: str = ""
    referencia: str = ""
    ip: str = ""
    extra: dict = field(default_factory=dict)
