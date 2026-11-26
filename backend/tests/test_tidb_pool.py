"""Pool de conexiones a TiDB: reutiliza, hace ping y descarta conexiones caídas."""
import pymysql
import pytest

from app.db import tidb as modulo
from app.db.tidb import TiDB


class ConexionFalsa:
    def __init__(self, n):
        self.n = n
        self.open = True
        self.responde = True
        self.pings = 0

    def ping(self, reconnect=False):
        self.pings += 1
        if not self.responde:
            raise pymysql.err.OperationalError(2006, "MySQL server has gone away")

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        self.open = False


@pytest.fixture
def abiertas(monkeypatch):
    lista = []

    def conectar(**kwargs):
        lista.append(ConexionFalsa(len(lista) + 1))
        return lista[-1]

    monkeypatch.setattr(modulo.pymysql, "connect", conectar)
    return lista


def test_reutiliza_la_conexion_con_ping(settings_prueba, abiertas):
    tidb = TiDB(settings_prueba)
    for _ in range(3):
        with tidb.conexion() as con:
            pass
    assert len(abiertas) == 1
    assert con.pings == 2  # ping antes de cada reutilización
    tidb.cerrar()
    assert not con.open


def test_conexion_caida_se_reemplaza(settings_prueba, abiertas):
    tidb = TiDB(settings_prueba)
    with tidb.conexion() as primera:
        pass
    primera.responde = False  # TiDB la cortó mientras estaba libre
    with tidb.conexion() as segunda:
        pass
    assert segunda is not primera and not primera.open

    # Un error durante el uso tampoco devuelve la conexión al pool
    with pytest.raises(pymysql.err.OperationalError), tidb.conexion() as con:
        raise pymysql.err.OperationalError(2013, "Lost connection")
    assert not con.open
    with tidb.conexion() as tercera:
        pass
    assert tercera is not con


def test_renueva_la_conexion_inactiva(settings_prueba, abiertas, monkeypatch):
    tidb = TiDB(settings_prueba)
    with tidb.conexion() as vieja:
        pass
    reloj = modulo.time.monotonic() + modulo.SEGUNDOS_RENOVAR + 1
    monkeypatch.setattr(modulo.time, "monotonic", lambda: reloj)
    with tidb.conexion() as nueva:
        pass
    assert nueva is not vieja and not vieja.open
    assert vieja.pings == 0  # ni siquiera se intenta: se renueva antes del corte


def test_pool_lleno_da_el_mismo_error_que_tidb_caida(settings_prueba, abiertas, monkeypatch):
    monkeypatch.setattr(modulo, "SEGUNDOS_ESPERA", 0.01)
    monkeypatch.setattr(modulo, "MAX_CONEXIONES", 1)
    tidb = TiDB(settings_prueba)
    with tidb.conexion():
        with pytest.raises(pymysql.err.OperationalError), tidb.conexion():
            pass
