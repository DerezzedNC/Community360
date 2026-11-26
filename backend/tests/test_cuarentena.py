"""GET /api/cuarentena (contrato v0.9). Sin red: Capella falsa."""
import pytest
from fastapi.testclient import TestClient

from app.db.capella import CapellaNoDisponible
from app.main import create_app
from tests.conftest import BaseFalsa

DOCS = [
    {"id_cuarentena": "q_1", "id_original": "I0000001", "motivos": ["usuario_inexistente"],
     "fuente": "csv", "id_lote": "lote-1", "detectado_en": "2026-11-20T10:00:00Z",
     "estado_revision": "pendiente",
     # Geografía que no debería estar: la API la quita igual
     "registro": {"id_interaccion": "I0000001", "id_usuario": "U999999", "tema": "musica",
                  "ciudad": "Mérida", "latitud": 20.96, "longitud": -89.62}},
    {"id_cuarentena": "q_2", "id_original": "I0000002", "motivos": ["duplicado"],
     "fuente": "csv", "id_lote": "lote-1", "detectado_en": "2026-11-20T10:00:00Z",
     "estado_revision": "pendiente", "registro": {"id_interaccion": "I0000002", "tema": "memes_humor"}},
]


class CapellaCuarentena(BaseFalsa):
    def __init__(self):
        super().__init__()
        self.consultas = []
        self.falla = None

    def consultar(self, sql, **parametros):
        if self.falla:
            raise self.falla
        self.consultas.append((sql, parametros))
        docs = [d for d in DOCS if parametros.get("motivo") in (None, *d["motivos"])]
        if sql.startswith("SELECT RAW COUNT(*)"):
            return [len(docs)]
        return docs[parametros["desde"]:parametros["desde"] + parametros["limite"]]


@pytest.fixture
def capella():
    return CapellaCuarentena()


@pytest.fixture
def cliente(settings_prueba, capella):
    app = create_app(settings_prueba, BaseFalsa(), capella)
    cliente = TestClient(app, raise_server_exceptions=False)
    cliente.headers["Authorization"] = f"Bearer {app.state.tokens.crear(1, 'analista')}"
    return cliente


def test_lista_paginada_con_campos_originales(cliente):
    r = cliente.get("/api/cuarentena", params={"limite": 1})
    assert r.status_code == 200
    cuerpo = r.json()
    assert (cuerpo["total"], cuerpo["pagina"], cuerpo["limite"]) == (2, 1, 1)
    [doc] = cuerpo["datos"]
    assert doc["tipo_registro"] == "interaccion"
    assert doc["motivos"] == ["usuario_inexistente"]
    assert doc["detectado_en"] == "2026-11-20T10:00:00Z"
    assert doc["registro"] == {"id_interaccion": "I0000001", "id_usuario": "U999999", "tema": "musica"}


def test_nunca_hay_ubicacion_ni_coordenadas(cliente):
    texto = cliente.get("/api/cuarentena").text
    for campo in ("ciudad", "latitud", "longitud", "Mérida", "20.96"):
        assert campo not in texto


def test_filtro_por_motivo_va_como_parametro(cliente, capella):
    r = cliente.get("/api/cuarentena", params={"motivo": "duplicado"}).json()
    assert r["total"] == 1 and r["datos"][0]["id_cuarentena"] == "q_2"
    sql, parametros = capella.consultas[0]
    assert "$motivo" in sql and parametros == {"motivo": "duplicado"}


@pytest.mark.parametrize("params", [{"motivo": "otro"}, {"limite": 201}, {"pagina": 0}])
def test_parametro_invalido_422(cliente, capella, params):
    assert cliente.get("/api/cuarentena", params=params).status_code == 422
    assert capella.consultas == []


def test_sin_sesion_401(cliente):
    del cliente.headers["Authorization"]
    assert cliente.get("/api/cuarentena").status_code == 401


def test_capella_caida_503(cliente, capella):
    capella.falla = CapellaNoDisponible("sin conexión")
    r = cliente.get("/api/cuarentena")
    assert (r.status_code, r.json()) == (503, {"detail": "Base de datos no disponible"})


@pytest.mark.nube
def test_cuarentena_real():
    """Solo lectura. Necesita Capella (con WARP apagado)."""
    app = create_app()
    cabecera = {"Authorization": f"Bearer {app.state.tokens.crear(1, 'analista')}"}
    with TestClient(app) as cliente:
        r = cliente.get("/api/cuarentena", headers=cabecera, params={"limite": 200})
        filtrada = cliente.get("/api/cuarentena", headers=cabecera, params={"motivo": "usuario_inexistente"})
    assert r.status_code == 200 and filtrada.status_code == 200
    assert r.json()["total"] >= filtrada.json()["total"] > 0
    assert all("usuario_inexistente" in d["motivos"] for d in filtrada.json()["datos"])
    assert not any(c in r.text for c in ('"latitud"', '"longitud"', '"ciudad"'))
