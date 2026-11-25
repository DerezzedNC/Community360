"""JWT de sesión y lista de tokens revocados por logout."""
import threading
import time
import uuid
from dataclasses import dataclass

import jwt

from app.config import Settings

ALGORITMO = "HS256"
ROLES = ("admin", "analista")


class TokenInvalido(ValueError):
    """Vencido, alterado, incompleto o revocado. No dice cuál, a propósito."""


@dataclass(frozen=True)
class Sesion:
    id_admin: int
    rol: str
    jti: str
    exp: int


class Tokens:
    """Crea, valida y revoca tokens.

    Limitación documentada en el contrato: los revocados viven en la memoria de este proceso.
    """

    def __init__(self, settings: Settings):
        self._clave = settings.JWT_SECRET.get_secret_value()
        self.segundos = settings.JWT_MINUTOS * 60
        self._revocados: dict[str, int] = {}  # jti -> exp
        self._candado = threading.Lock()

    def crear(self, id_admin: int, rol: str) -> str:
        datos = {
            "sub": str(id_admin),
            "rol": rol,
            "jti": uuid.uuid4().hex,
            "exp": int(time.time()) + self.segundos,
        }
        return jwt.encode(datos, self._clave, algorithm=ALGORITMO)

    def validar(self, token: str) -> Sesion:
        try:
            # El algoritmo es fijo: no se confía en el que diga el token
            datos = jwt.decode(
                token,
                self._clave,
                algorithms=[ALGORITMO],
                options={"require": ["sub", "rol", "jti", "exp"]},
            )
            sesion = Sesion(int(datos["sub"]), datos["rol"], datos["jti"], int(datos["exp"]))
        except (jwt.PyJWTError, ValueError):
            raise TokenInvalido from None
        if sesion.rol not in ROLES or self._esta_revocado(sesion.jti):
            raise TokenInvalido
        return sesion

    def revocar(self, sesion: Sesion) -> None:
        ahora = time.time()
        with self._candado:
            # Los que ya vencieron se quitan: de todos modos darían 401
            self._revocados = {j: exp for j, exp in self._revocados.items() if exp > ahora}
            self._revocados[sesion.jti] = sesion.exp

    def _esta_revocado(self, jti: str) -> bool:
        with self._candado:
            return jti in self._revocados
