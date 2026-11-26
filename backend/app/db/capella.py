"""Conexión a Couchbase Capella. Un solo cluster para toda la aplicación.

Si el cluster está apagado, el SDK puede tardar más de un minuto en rendirse. Por eso la
conexión se hace en un hilo aparte: ni el arranque ni las peticiones se quedan esperando.
"""
import logging
import threading
import time
from datetime import timedelta

from couchbase.auth import PasswordAuthenticator
from couchbase.cluster import Cluster
from couchbase.collection import Collection
from couchbase.n1ql import QueryScanConsistency
from couchbase.options import ClusterOptions, ExistsOptions, QueryOptions

from app.config import Settings

logger = logging.getLogger("community360.capella")

SEGUNDOS_ENTRE_REINTENTOS = 15


class CapellaNoDisponible(RuntimeError):
    """No hay conexión con Couchbase Capella."""


class Capella:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._cluster: Cluster | None = None
        self._candado = threading.Lock()
        self._intento_terminado = threading.Event()
        self._conectando = False
        self._cerrada = False
        self._siguiente_intento = 0.0

    def conectar(self, esperar: float = 0) -> bool:
        """Inicia la conexión si hace falta y espera como máximo `esperar` segundos."""
        with self._candado:
            puede_intentar = (
                self._cluster is None
                and not self._conectando
                and not self._cerrada
                and time.monotonic() >= self._siguiente_intento
            )
            if puede_intentar:
                self._conectando = True
                self._intento_terminado.clear()
                threading.Thread(target=self._intentar, name="capella", daemon=True).start()
        if esperar:
            self._intento_terminado.wait(esperar)
        return self._cluster is not None

    def _intentar(self) -> None:
        s = self._settings
        cluster = None
        listo = False
        try:
            opciones = ClusterOptions(
                PasswordAuthenticator(s.CB_USER, s.CB_PASSWORD.get_secret_value())
            )
            opciones.apply_profile("wan_development")
            cluster = Cluster(s.CB_CONN, opciones)
            cluster.wait_until_ready(timedelta(seconds=15))
            listo = True
        except Exception as e:
            # Solo el tipo: el mensaje puede traer usuario y servidor
            logger.warning("No se pudo conectar a Capella (%s)", type(e).__name__)
        with self._candado:
            if listo and not self._cerrada:
                self._cluster, cluster = cluster, None
            else:
                self._siguiente_intento = time.monotonic() + SEGUNDOS_ENTRE_REINTENTOS
            self._conectando = False
        self._intento_terminado.set()
        # Si no se va a usar (falló o la app ya se cerró), se libera
        if cluster is not None:
            try:
                cluster.close()
            except Exception as e:
                logger.warning("No se pudo cerrar el cluster (%s)", type(e).__name__)

    def coleccion(self, nombre: str) -> Collection:
        self.conectar()
        cluster = self._cluster
        if cluster is None:
            raise CapellaNoDisponible("Couchbase Capella no está disponible")
        s = self._settings
        return cluster.bucket(s.CB_BUCKET).scope(s.CB_SCOPE).collection(nombre)

    def consultar(self, sql: str, **parametros) -> list:
        """Consulta SQL++ dentro del scope (FROM interacciones, FROM cuarentena).

        request_plus: la consulta ve todo lo escrito antes, aunque el índice no se haya
        actualizado todavía. Los valores del cliente van siempre como $parametros.
        """
        self.conectar()
        cluster = self._cluster
        if cluster is None:
            raise CapellaNoDisponible("Couchbase Capella no está disponible")
        s = self._settings
        opciones = QueryOptions(
            named_parameters=parametros,
            scan_consistency=QueryScanConsistency.REQUEST_PLUS,
            timeout=timedelta(seconds=15),
        )
        resultado = cluster.bucket(s.CB_BUCKET).scope(s.CB_SCOPE).query(sql, opciones)
        return list(resultado.rows())

    def probar(self) -> bool:
        """True si se puede leer la colección interacciones. No escribe nada."""
        try:
            # La clave no existe; solo interesa que el servidor conteste
            self.coleccion("interacciones").exists(
                "health", ExistsOptions(timeout=timedelta(seconds=5))
            )
            return True
        except Exception as e:
            logger.warning("Capella no responde (%s)", type(e).__name__)
            return False

    def cerrar(self) -> None:
        with self._candado:
            self._cerrada = True
            cluster, self._cluster = self._cluster, None
        if cluster is not None:
            cluster.close()
