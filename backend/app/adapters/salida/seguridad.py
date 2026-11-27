"""Adaptadores criptográficos: Argon2id para contraseñas y JWT firmado con Ed25519."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.application.errores import TokenInvalido
from app.application.puertos import Reclamos
from app.domain.usuarios import Rol, Usuario


class HasherArgon2:
    """Argon2id con los parámetros por defecto de argon2-cffi (RFC 9106, perfil de baja memoria)."""

    def __init__(self, hasher: PasswordHasher | None = None):
        self._h = hasher or PasswordHasher()

    def hash(self, contrasena: str) -> str:
        return self._h.hash(contrasena)

    def verificar(self, hash_: str, contrasena: str) -> bool:
        try:
            return self._h.verify(hash_, contrasena)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False

    def necesita_rehash(self, hash_: str) -> bool:
        return self._h.check_needs_rehash(hash_)


ALGORITMO = "EdDSA"


def generar_clave(ruta: Path) -> None:
    """Crea la clave privada Ed25519 (solo lectura para el dueño) si no existe."""
    if ruta.exists():
        return
    ruta.parent.mkdir(parents=True, exist_ok=True)
    pem = Ed25519PrivateKey.generate().private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    ruta.write_bytes(pem)
    ruta.chmod(0o400)


class TokensJWT:
    def __init__(self, clave_privada_pem: bytes, emisor: str, audiencia: str, duracion: timedelta):
        self._privada = serialization.load_pem_private_key(clave_privada_pem, password=None)
        if not isinstance(self._privada, Ed25519PrivateKey):
            raise ValueError("La clave del JWT debe ser Ed25519.")
        self._publica = self._privada.public_key()
        self.emisor, self.audiencia, self.duracion = emisor, audiencia, duracion

    def emitir_acceso(self, u: Usuario, ahora: datetime) -> tuple[str, datetime]:
        expira = ahora + self.duracion
        reclamos = {"iss": self.emisor, "aud": self.audiencia, "sub": u.id, "rol": u.rol.value,
                    "jti": str(uuid.uuid4()), "iat": int(ahora.timestamp()), "nbf": int(ahora.timestamp()),
                    "exp": int(expira.timestamp())}
        return jwt.encode(reclamos, self._privada, algorithm=ALGORITMO), expira

    def verificar_acceso(self, token: str) -> Reclamos:
        try:
            # La lista fija de algoritmos impide «none» y la confusión entre algoritmos (por ejemplo, HS256).
            r = jwt.decode(token, self._publica, algorithms=[ALGORITMO], audience=self.audiencia, issuer=self.emisor,
                           options={"require": ["exp", "iat", "nbf", "iss", "aud", "sub", "jti", "rol"]})
            return Reclamos(str(r["sub"]), Rol(r["rol"]), str(r["jti"]), datetime.fromtimestamp(r["exp"], UTC))
        except (jwt.PyJWTError, ValueError, KeyError) as e:
            raise TokenInvalido() from e


class RelojSistema:
    def ahora(self) -> datetime:
        return datetime.now(UTC)
