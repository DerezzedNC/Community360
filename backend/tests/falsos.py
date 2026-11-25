"""Sustitutos de las bases para las pruebas sin red."""
from contextlib import contextmanager

from app.seguridad import crear_hash
from tests.conftest import BaseFalsa

PASSWORD = "clave-falsa-de-prueba-123"
HASH = crear_hash(PASSWORD)


def cuenta(id_admin, correo, nombre, rol, activo=1):
    return {
        "id_admin": id_admin, "correo": correo, "nombre": nombre, "password_hash": HASH,
        "rol": rol, "activo": activo,
    }


class TiDBFalsa(BaseFalsa):
    """Cuentas en memoria. Nunca se conecta a nada."""

    def __init__(self):
        super().__init__()
        self.cuentas = [
            cuenta(1, "ana@prueba.mx", "Ana", "admin"),
            cuenta(2, "leo@prueba.mx", "Leo", "analista"),
            cuenta(3, "baja@prueba.mx", "Baja", "analista", activo=0),
        ]
        self.accesos = []
        self.falla = None
        self._fila = None

    @contextmanager
    def conexion(self):
        if self.falla:
            raise self.falla
        yield self

    @contextmanager
    def cursor(self):
        yield self

    def execute(self, sql, parametros):
        assert sql.count("%s") == len(parametros)
        if sql.startswith("UPDATE"):
            assert "ultimo_acceso = CURRENT_TIMESTAMP" in sql
            self.accesos.append(parametros[0])
            return
        campo = "correo" if "WHERE correo" in sql else "id_admin"
        self._fila = next((c for c in self.cuentas if c[campo] == parametros[0]), None)

    def fetchone(self):
        return self._fila
