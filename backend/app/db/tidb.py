"""Conexión a TiDB Cloud con PyMySQL y TLS verificado, con un pool pequeño.

Abrir una conexión TLS con TiDB Cloud tarda de 0.5 a varios segundos; reutilizarla evita
pagar ese costo en cada petición. Reglas del pool:
- Como máximo MAX_CONEXIONES abiertas a la vez. Si están todas ocupadas, se espera
  SEGUNDOS_ESPERA y después se responde 503, igual que si TiDB no contestara.
- Antes de reutilizar una conexión se le hace ping. Si falla, se cierra y se abre otra.
- Una conexión que lleva más de SEGUNDOS_RENOVAR sin usarse se cierra y se abre otra,
  antes de que el servidor la corte por inactividad.
- Si hubo un error durante su uso, la conexión se cierra: nunca vuelve al pool.
"""
import logging
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager

import certifi
import pymysql
from pymysql.cursors import DictCursor

from app.config import Settings

logger = logging.getLogger("community360.tidb")

MAX_CONEXIONES = 4
SEGUNDOS_RENOVAR = 240
SEGUNDOS_ESPERA = 10


class TiDB:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._libres: list[tuple[pymysql.connections.Connection, float]] = []  # (conexión, último uso)
        self._candado = threading.Lock()
        self._cupos = threading.BoundedSemaphore(MAX_CONEXIONES)
        self._cerrado = False

    def _abrir(self) -> pymysql.connections.Connection:
        s = self._settings
        return pymysql.connect(
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

    @staticmethod
    def _descartar(con) -> None:
        try:
            if con.open:
                con.close()
        except Exception:
            pass  # ya estaba cerrada o la red se cayó: no hay nada más que hacer

    def _tomar(self) -> pymysql.connections.Connection:
        """Una conexión libre que responda, o una nueva."""
        while True:
            with self._candado:
                if not self._libres:
                    break
                con, ultimo_uso = self._libres.pop()
            if time.monotonic() - ultimo_uso < SEGUNDOS_RENOVAR:
                try:
                    con.ping(reconnect=False)
                    return con
                except Exception as e:
                    logger.info("Conexión del pool sin respuesta (%s); se abre otra", type(e).__name__)
            self._descartar(con)
        return self._abrir()

    def _devolver(self, con) -> None:
        with self._candado:
            if not self._cerrado:
                self._libres.append((con, time.monotonic()))
                return
        self._descartar(con)

    @contextmanager
    def conexion(self) -> Iterator[pymysql.connections.Connection]:
        """Presta una conexión: confirma si todo sale bien y revierte si hay error."""
        if not self._cupos.acquire(timeout=SEGUNDOS_ESPERA):
            # Mismo tipo de error que una TiDB caída: main.py lo convierte en 503
            raise pymysql.err.OperationalError(2013, "Sin conexiones libres en el pool")
        try:
            con = self._tomar()
            try:
                yield con
                con.commit()
            except BaseException:
                # Si la conexión ya se perdió, el rollback no debe tapar el error original
                try:
                    con.rollback()
                except Exception:
                    pass
                self._descartar(con)
                raise
            self._devolver(con)
        finally:
            self._cupos.release()

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

    def cerrar(self) -> None:
        with self._candado:
            self._cerrado = True
            libres, self._libres = self._libres, []
        for con, _ in libres:
            self._descartar(con)
