"""Conexión a TiDB Cloud con PyMySQL y TLS verificado."""
import logging
from collections.abc import Iterator
from contextlib import contextmanager

import certifi
import pymysql
from pymysql.cursors import DictCursor

from app.config import Settings

logger = logging.getLogger("community360.tidb")


class TiDB:
    def __init__(self, settings: Settings):
        self._settings = settings

    @contextmanager
    def conexion(self) -> Iterator[pymysql.connections.Connection]:
        """Abre una conexión, confirma si todo sale bien y revierte si hay error."""
        s = self._settings
        con = pymysql.connect(
            host=s.TIDB_HOST,
            port=s.TIDB_PORT,
            user=s.TIDB_USER,
            password=s.TIDB_PASSWORD.get_secret_value(),
            database=s.TIDB_DB,
            ssl={"ca": certifi.where()},
            ssl_verify_cert=True,
            ssl_verify_identity=True,
            charset="utf8mb4",
            cursorclass=DictCursor,
            autocommit=False,
            connect_timeout=10,
            read_timeout=15,
            write_timeout=15,
            # El contrato pide fechas en UTC
            init_command="SET time_zone = '+00:00'",
        )
        try:
            yield con
            con.commit()
        except BaseException:
            # Si la conexión ya se perdió, el rollback no debe tapar el error original
            try:
                con.rollback()
            except pymysql.MySQLError:
                pass
            raise
        finally:
            # close() falla si PyMySQL ya había cerrado la conexión
            if con.open:
                con.close()

    def probar(self) -> bool:
        """True si la base responde. Solo lectura."""
        try:
            with self.conexion() as con, con.cursor() as cur:
                cur.execute("SELECT 1 AS ok")
                return cur.fetchone()["ok"] == 1
        except Exception as e:
            # Solo el tipo: el mensaje puede traer usuario y servidor
            logger.warning("TiDB no responde (%s)", type(e).__name__)
            return False
