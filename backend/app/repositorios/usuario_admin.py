"""Consultas a la tabla usuario_admin de TiDB."""
import pymysql

from app.db.tidb import TiDB

CLAVE_DUPLICADA = 1062  # código de MySQL/TiDB para un valor UNIQUE repetido


class CorreoRepetido(ValueError):
    """Ya existe una cuenta con ese correo."""


def buscar_por_correo(tidb: TiDB, correo: str) -> dict | None:
    with tidb.conexion() as con, con.cursor() as cur:
        cur.execute(
            "SELECT id_admin, correo, nombre, password_hash, rol, activo "
            "FROM usuario_admin WHERE correo = %s",
            (correo,),
        )
        return cur.fetchone()


def insertar(tidb: TiDB, correo: str, nombre: str, password_hash: str, rol: str) -> int:
    """Crea la cuenta y devuelve su id_admin. Recibe el hash, nunca la contraseña."""
    try:
        # El commit va dentro del try: TiDB puede avisar del duplicado hasta ese momento
        with tidb.conexion() as con, con.cursor() as cur:
            cur.execute(
                "INSERT INTO usuario_admin (correo, nombre, password_hash, rol) "
                "VALUES (%s, %s, %s, %s)",
                (correo, nombre, password_hash, rol),
            )
            id_admin = cur.lastrowid
    except pymysql.err.IntegrityError as e:
        if e.args and e.args[0] == CLAVE_DUPLICADA:
            # "from None": el error original trae el correo y la tabla
            raise CorreoRepetido("Ya existe una cuenta con ese correo") from None
        raise
    return id_admin
