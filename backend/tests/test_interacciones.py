"""CRUD de interacciones (contrato v0.10). Sin red: TiDB y Capella falsas."""
from contextlib import contextmanager
from datetime import date
from types import SimpleNamespace

import pytest
from couchbase.exceptions import DocumentExistsException, DocumentNotFoundException
from fastapi.testclient import TestClient

from app.db.capella import CapellaNoDisponible
from app.main import create_app
from tests.conftest import BaseFalsa
from tests.falsos import cuenta


def catalogo(tabla, codigo, activo=1, admite_texto=None):
    return {"catalogo": tabla, "codigo": codigo, "nombre": codigo, "extra": admite_texto, "activo": activo}


CATALOGOS = [
    catalogo("plataforma", "discord"), catalogo("plataforma", "myspace", activo=0),
    catalogo("tipo_interaccion", "comentario", admite_texto=1),
    catalogo("tipo_interaccion", "reaccion", admite_texto=0),
    catalogo("tema", "musica"), catalogo("dispositivo", "android"), catalogo("etiqueta", "arte"),
]
USUARIOS = {"U000001": date(2024, 1, 1)}


class TiDBInteracciones(BaseFalsa):
    """Cuentas del dashboard, fechas de ingreso y catálogos en memoria."""

    def __init__(self):
        super().__init__()
        self.cuentas = {1: cuenta(1, "ana@prueba.mx", "Ana", "admin"),
                        2: cuenta(2, "leo@prueba.mx", "Leo", "analista")}
        self._filas = []

    @contextmanager
    def conexion(self):
        yield self

    @contextmanager
    def cursor(self):
        yield self

    def execute(self, sql, parametros=None):
        if "FROM usuario_admin" in sql:
            self._filas = [self.cuentas[parametros[0]]] if parametros[0] in self.cuentas else []
        elif "FROM usuario WHERE" in sql:
            fecha = USUARIOS.get(parametros[0])
            self._filas = [{"fecha_ingreso": fecha}] if fecha else []
        else:
            self._filas = CATALOGOS

    def fetchone(self):
        return self._filas[0] if self._filas else None

    def fetchall(self):
        return self._filas


class ColeccionFalsa:
    def __init__(self, docs):
        self.docs = docs

    def get(self, llave):
        if llave not in self.docs:
            raise DocumentNotFoundException()
        return SimpleNamespace(content_as={dict: dict(self.docs[llave])})

    def insert(self, llave, doc):
        if llave in self.docs:
            raise DocumentExistsException()
        self.docs[llave] = doc

    def replace(self, llave, doc):
        if llave not in self.docs:
            raise DocumentNotFoundException()
        self.docs[llave] = doc

    def remove(self, llave):
        if llave not in self.docs:
            raise DocumentNotFoundException()
        del self.docs[llave]


class CapellaInteracciones(BaseFalsa):
    def __init__(self):
        super().__init__()
        self.docs = {"I0000203": {**valida(), "metadatos": {"origen": "csv", "id_lote": "lote-1"}}}
        self.falla = None

    def coleccion(self, nombre):
        if self.falla:
            raise self.falla
        assert nombre == "interacciones"
        return ColeccionFalsa(self.docs)

    def consultar(self, sql, **parametros):
        if self.falla:
            raise self.falla
        if "MAX(META(i).id)" in sql:
            return [max(self.docs)]
        docs = [{"id_interaccion": k, **v} for k, v in sorted(self.docs.items())
                if all(v.get(c) == parametros[c] for c in ("id_usuario", "tema") if c in parametros)]
        if sql.startswith("SELECT RAW COUNT(*)"):
            return [len(docs)]
        return docs[parametros["salto"]:parametros["salto"] + parametros["limite"]]


def valida(**cambios):
    datos = {
        "id_usuario": "U000001", "timestamp": "2026-11-25T18:00:00Z", "canal": "discord",
        "tipo": "comentario", "tema": "musica", "dispositivo": "android", "texto": "Hola comunidad",
        "sentimiento": 0.5, "idioma": "es", "reacciones_recibidas": 0, "etiquetas": ["arte"],
    }
    datos.update(cambios)
    return {k: v for k, v in datos.items() if v is not None}


@pytest.fixture
def capella():
    return CapellaInteracciones()


@pytest.fixture
def app(settings_prueba, capella):
    app = create_app(settings_prueba, TiDBInteracciones(), capella)
    app.state.avisos = []
    app.state.avisar_cambio = lambda: app.state.avisos.append(1)
    return app


@pytest.fixture
def cliente(app):
    return TestClient(app, raise_server_exceptions=False)


def como(app, rol="admin"):
    return {"Authorization": f"Bearer {app.state.tokens.crear(1 if rol == 'admin' else 2, rol)}"}


def test_crear_genera_id_y_calcula_longitud(app, cliente, capella):
    r = cliente.post("/api/interacciones", headers=como(app), json=valida())
    assert r.status_code == 201
    assert r.json()["id_interaccion"] == "I0000204"
    assert r.json()["longitud_texto"] == len("Hola comunidad")
    guardado = capella.docs["I0000204"]
    assert guardado["metadatos"]["origen"] == "api"
    assert app.state.avisos == [1]


def test_reaccion_sin_texto(app, cliente, capella):
    r = cliente.post("/api/interacciones", headers=como(app), json=valida(tipo="reaccion", texto=None))
    assert r.status_code == 201
    assert "texto" not in capella.docs[r.json()["id_interaccion"]]


@pytest.mark.parametrize("campo", ["pais", "ciudad", "latitud", "longitud", "longitud_texto"])
def test_no_acepta_ubicacion_ni_campos_extra(app, cliente, capella, campo):
    r = cliente.post("/api/interacciones", headers=como(app), json={**valida(), campo: 1})
    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["body", campo]
    assert len(capella.docs) == 1  # no se escribió nada


@pytest.mark.parametrize("cambios, campo", [
    ({"id_usuario": "U999999"}, "id_usuario"),
    ({"timestamp": "2023-12-31T23:59:59Z"}, "timestamp"),
    ({"canal": "myspace"}, "canal"),            # existe pero está inactivo
    ({"tema": "politica"}, "tema"),
    ({"etiquetas": ["arte", "spam"]}, "etiquetas"),
    ({"tipo": "reaccion"}, "texto"),            # reacción con texto
    ({"texto": None}, "texto"),                 # comentario sin texto
    ({"sentimiento": 1.5}, "sentimiento"),
    ({"idioma": "fr"}, "idioma"),
])
def test_validaciones_422(app, cliente, capella, cambios, campo):
    r = cliente.post("/api/interacciones", headers=como(app), json=valida(**cambios))
    assert r.status_code == 422
    assert ["body", campo] in [e["loc"][:2] for e in r.json()["detail"]]
    assert len(capella.docs) == 1


def test_id_repetido_409(app, cliente):
    r = cliente.post("/api/interacciones", headers=como(app), json={**valida(), "id_interaccion": "I0000203"})
    assert (r.status_code, r.json()) == (409, {"detail": "Ya existe una interacción con ese id"})


def test_leer_editar_y_borrar(app, cliente, capella):
    lista = cliente.get("/api/interacciones", headers=como(app, "analista"), params={"id_usuario": "U000001"})
    assert lista.status_code == 200 and lista.json()["total"] == 1
    assert cliente.get("/api/interacciones/I0000203", headers=como(app, "analista")).status_code == 200

    r = cliente.put("/api/interacciones/I0000203", headers=como(app), json=valida(tema="musica", sentimiento=-0.2))
    assert r.status_code == 200 and r.json()["sentimiento"] == -0.2
    metadatos = capella.docs["I0000203"]["metadatos"]
    assert metadatos["origen"] == "csv" and metadatos["actualizado_por"] == 1  # conserva su origen

    assert cliente.delete("/api/interacciones/I0000203", headers=como(app)).status_code == 204
    assert cliente.get("/api/interacciones/I0000203", headers=como(app)).status_code == 404
    assert cliente.delete("/api/interacciones/I0000203", headers=como(app)).status_code == 404
    assert cliente.put("/api/interacciones/I0000203", headers=como(app), json=valida()).status_code == 404
    assert app.state.avisos == [1, 1]  # editar y borrar; los 404 no avisan


def test_analista_no_escribe_403(app, cliente, capella):
    h = como(app, "analista")
    assert cliente.post("/api/interacciones", headers=h, json=valida()).status_code == 403
    assert cliente.put("/api/interacciones/I0000203", headers=h, json=valida()).status_code == 403
    assert cliente.delete("/api/interacciones/I0000203", headers=h).status_code == 403
    assert len(capella.docs) == 1


def test_sin_sesion_401(cliente):
    assert cliente.get("/api/interacciones").status_code == 401
    assert cliente.post("/api/interacciones", json=valida()).status_code == 401


def test_capella_caida_503(app, cliente, capella):
    capella.falla = CapellaNoDisponible("sin conexión")
    r = cliente.get("/api/interacciones", headers=como(app))
    assert (r.status_code, r.json()) == (503, {"detail": "Base de datos no disponible"})
    assert cliente.post("/api/interacciones", headers=como(app), json=valida()).status_code == 503


@pytest.mark.nube
def test_crud_real_crea_edita_y_borra_su_propia_interaccion():
    """Escribe en Capella real, pero solo su propia interacción, y la borra siempre al final."""
    app = create_app()
    admin = {"Authorization": f"Bearer {app.state.tokens.crear(1, 'admin')}"}
    with TestClient(app) as cliente:
        usuario = cliente.get("/api/usuarios", headers=admin, params={"limite": 1}).json()["datos"][0]
        cuerpo = valida(id_usuario=usuario["id_usuario"], etiquetas=["musica"], texto="Prueba automática")
        creada = cliente.post("/api/interacciones", headers=admin, json=cuerpo)
        assert creada.status_code == 201, creada.text
        id_nueva = creada.json()["id_interaccion"]
        try:
            antes = cliente.get("/api/metricas/resumen", headers=admin).json()["interacciones"]
            editada = cliente.put(f"/api/interacciones/{id_nueva}", headers=admin,
                                  json={**cuerpo, "sentimiento": -0.25})
            assert editada.status_code == 200 and editada.json()["sentimiento"] == -0.25
            leida = cliente.get(f"/api/interacciones/{id_nueva}", headers=admin).json()
            assert leida["sentimiento"] == -0.25 and "metadatos" not in leida
        finally:
            borrada = cliente.delete(f"/api/interacciones/{id_nueva}", headers=admin)
        assert borrada.status_code == 204
        assert cliente.get(f"/api/interacciones/{id_nueva}", headers=admin).status_code == 404
        despues = cliente.get("/api/metricas/resumen", headers=admin).json()["interacciones"]
        assert despues == antes - 1  # las métricas ven el cambio al momento (request_plus)
