"""Errores de la aplicación. Sus mensajes son seguros para mostrar: nunca llevan contraseñas ni datos de personas."""


class ErrorAplicacion(Exception):
    codigo = 400

    def __init__(self, mensaje: str):
        super().__init__(mensaje)
        self.mensaje = mensaje


class CredencialesInvalidas(ErrorAplicacion):
    codigo = 401

    def __init__(self):
        # Mismo texto para usuario inexistente, contraseña errónea, rol de otra pestaña o cuenta bloqueada.
        super().__init__("Usuario o contraseña incorrectos, o la cuenta está bloqueada temporalmente.")


class SesionInvalida(ErrorAplicacion):
    codigo = 401

    def __init__(self, mensaje: str = "La sesión no es válida o expiró. Inicie sesión de nuevo."):
        super().__init__(mensaje)


class TokenInvalido(SesionInvalida):
    pass


class SinPermiso(ErrorAplicacion):
    codigo = 403

    def __init__(self, mensaje: str = "No tiene permiso para esta acción."):
        super().__init__(mensaje)


class DatosInvalidos(ErrorAplicacion):
    codigo = 422

    def __init__(self, errores: list[str]):
        super().__init__(" ".join(errores))
        self.errores = errores


class Conflicto(ErrorAplicacion):
    codigo = 409
