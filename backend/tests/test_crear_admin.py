from contextlib import contextmanager
from types import SimpleNamespace

import pymysql
import pytest

from app.seguridad import verificar_password
from scripts import crear_admin

PASSWORD = "clave-falsa-de-prueba-123"


class TiDBFalsa:
    """Guarda las cuentas en memoria. Nunca se conecta a nada."""

    def __init__(self, existentes=(), falla=None, falla_al_insertar=None, falla_al_confirmar=None):
        self.cuentas = [{"correo": c} for c in existentes]
        self.falla = falla
        self.falla_al_insertar = falla_al_insertar
        self.falla_al_confirmar = falla_al_confirmar
        self.lastrowid = None
        self._fila = None
        self._inserto = False

    @contextmanager
    def conexion(self):
        if self.falla:
            raise self.falla
        yield self
        if self._inserto and self.falla_al_confirmar:
            self.cuentas.pop()
            raise self.falla_al_confirmar

    @contextmanager
    def cursor(self):
        yield self

    def execute(self, sql, parametros):
        # Los datos siempre van como parámetros, nunca dentro del SQL
        assert sql.count("%s") == len(parametros)
        if sql.startswith("SELECT"):
            self._fila = next((c for c in self.cuentas if c["correo"] == parametros[0]), None)
            return
        if self.falla_al_insertar:
            raise self.falla_al_insertar
        campos = ("correo", "nombre", "password_hash", "rol")
        self.cuentas.append(dict(zip(campos, parametros, strict=True)))
        self.lastrowid = len(self.cuentas)
        self._inserto = True

    def fetchone(self):
        return self._fila


def correr(tidb, textos, passwords=(PASSWORD, PASSWORD)):
    """Contesta en orden y comprueba que el script no haya dejado respuestas sin usar."""
    textos, passwords = iter(textos), iter(passwords)
    codigo = crear_admin.ejecutar(tidb, lambda _: next(textos), lambda _: next(passwords))
    assert list(textos) == [] and list(passwords) == []
    return codigo


@pytest.mark.parametrize("rol", ["admin", "analista"])
def test_alta_correcta(capsys, caplog, rol):
    tidb = TiDBFalsa()
    assert correr(tidb, [" Ana@Prueba.MX ", " Ana ", rol.upper()]) == 0
    [cuenta] = tidb.cuentas
    assert (cuenta["correo"], cuenta["nombre"], cuenta["rol"]) == ("ana@prueba.mx", "Ana", rol)
    assert verificar_password(PASSWORD, cuenta["password_hash"])
    assert PASSWORD not in str(tidb.cuentas)
    salida = capsys.readouterr()
    assert f"id_admin=1 · ana@prueba.mx · {rol}" in salida.out
    for texto in (salida.out, salida.err, caplog.text):
        assert PASSWORD not in texto
        assert cuenta["password_hash"] not in texto


def test_correo_repetido_no_pide_password(capsys):
    tidb = TiDBFalsa(existentes=["ana@prueba.mx"])
    # Sin más respuestas: si el script preguntara algo más, saldría otro mensaje
    assert correr(tidb, ["ANA@prueba.mx"], []) == 1
    assert "Ya existe una cuenta" in capsys.readouterr().out
    assert tidb.cuentas == [{"correo": "ana@prueba.mx"}]


@pytest.mark.parametrize("momento", ["falla_al_insertar", "falla_al_confirmar"])
def test_correo_repetido_por_otro_al_mismo_tiempo(capsys, momento):
    error = pymysql.err.IntegrityError(1062, "Duplicate entry 'ana@prueba.mx'")
    tidb = TiDBFalsa(**{momento: error})
    assert correr(tidb, ["ana@prueba.mx", "Ana", "admin"]) == 1
    assert "Ya existe una cuenta" in capsys.readouterr().out
    assert tidb.cuentas == []


def test_otro_error_de_integridad_no_se_confunde_con_repetido(capsys):
    tidb = TiDBFalsa(falla_al_insertar=pymysql.err.IntegrityError(3819, "detalle privado"))
    assert correr(tidb, ["ana@prueba.mx", "Ana", "admin"]) == 1
    salida = capsys.readouterr().out
    assert "IntegrityError" in salida
    assert "Ya existe una cuenta" not in salida
    assert "detalle privado" not in salida


def test_datos_invalidos_se_vuelven_a_pedir(capsys):
    tidb = TiDBFalsa()
    correo_largo = "a" * 60 + "@" + "b" * 60 + ".mx"
    textos = [
        "sin-arroba", correo_largo, "ana@prueba.mx",
        "   ", "x" * 81, "Ana",
        "root", "admin",
    ]
    assert correr(tidb, textos) == 0
    salida = capsys.readouterr().out
    assert "formato válido" in salida
    assert "máximo 120" in salida
    assert salida.count("de 1 a 80") == 2
    assert "debe ser admin o analista" in salida
    assert len(tidb.cuentas) == 1


def test_password_corta_distinta_o_con_control_se_vuelve_a_pedir(capsys):
    tidb = TiDBFalsa()
    rechazadas = ["once-letras", "con-control-\x16\x16", "clave-larga-456", "otra-larga-7890"]
    assert correr(tidb, ["ana@prueba.mx", "Ana", "admin"], [*rechazadas, PASSWORD, PASSWORD]) == 0
    salida = capsys.readouterr().out
    assert "al menos 12" in salida
    assert "no válidos" in salida
    assert "no coinciden" in salida
    for password in (*rechazadas, PASSWORD):
        assert password not in salida
    assert verificar_password(PASSWORD, tidb.cuentas[0]["password_hash"])


def test_minimo_exacto_de_12():
    assert crear_admin.validar_password("x" * 12)
    with pytest.raises(ValueError):
        crear_admin.validar_password("x" * 11)


def test_falla_de_tidb_no_filtra_detalles(capsys, caplog):
    tidb = TiDBFalsa(falla=pymysql.err.OperationalError(2003, f"host privado {PASSWORD}"))
    assert correr(tidb, ["ana@prueba.mx"], []) == 1
    salida = capsys.readouterr()
    assert "OperationalError" in salida.out
    for texto in (salida.out, salida.err, caplog.text):
        assert "host privado" not in texto
        assert PASSWORD not in texto


@pytest.mark.parametrize("error", [KeyboardInterrupt, EOFError])
def test_cancelar_no_guarda_nada(capsys, error):
    def cancela(_):
        raise error

    tidb = TiDBFalsa()
    textos = iter(["ana@prueba.mx", "Ana", "admin"])
    assert crear_admin.ejecutar(tidb, lambda _: next(textos), cancela) == 1
    assert "Cancelado" in capsys.readouterr().out
    assert tidb.cuentas == []


def test_sin_terminal_no_corre(monkeypatch, capsys):
    monkeypatch.setattr(crear_admin.sys, "stdin", SimpleNamespace(isatty=lambda: False))
    monkeypatch.setattr(crear_admin, "get_settings", lambda: pytest.fail("no debe llegar aquí"))
    assert crear_admin.main() == 1
    assert "PowerShell" in capsys.readouterr().out
