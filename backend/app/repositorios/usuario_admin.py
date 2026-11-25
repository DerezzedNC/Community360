"""Consultas a la tabla usuario_admin de TiDB."""
import pymysql
from pymysql.connections import Connection

from app.db.tidb import TiDB

CLAVE_DUPLICADA = 1062  # código de MySQL/TiDB para un valor UNIQUE repetido


class CorreoRepetido(ValueError):
    """Ya existe una cuenta con ese correo."""


def buscar_por_correo(con: Connection, correo: str) -> dict | None:
    with con.cursor() as cur:
        cur.execute(
            "SELECT id_admin, correo, nombre, password_hash, rol, activo "
            "FROM usuario_admin WHERE correo = %s",
            (correo,),
        )
        return cur.fetchone()


def buscar_por_id(con: Connection, id_admin: int) -> dict | None:
    with con.cursor() as cur:
        cur.execute(
            "SELECT id_admin, correo, nombre, rol, activo FROM usuario_admin WHERE id_admin = %s",
            (id_admin,),
        )
        return cur.fetchone()


def registrar_acceso(con: Connection, id_admin: int) -> None:
    with con.cursor() as cur:
        cur.execute(
            "UPDATE usuario_admin SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_admin = %s",
            (id_admin,),
        )


def insertar(tidb: TiDB, correo: str, nombre: str, password_hash: str, rol: str) -> int:
    """Crea la cuenta y devuelve su id_admin. Recibe el hash, nunca la contraseña."""
    try:
        # Abre su propia conexión para que el commit quede dentro del try: TiDB puede
        # avisar del duplicado hasta ese momento
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
