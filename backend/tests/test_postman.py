"""Los archivos de postman/ son válidos, no llevan secretos y cubren los endpoints."""
import json
import re
from pathlib import Path

import pytest

from app.main import create_app
from tests.conftest import BaseFalsa

POSTMAN = Path(__file__).resolve().parents[2] / "postman"
# Las crean los scripts de la colección; no van en el entorno
LOCALES = {"c360_correo_json", "c360_password_json", "c360_exp", "c360_cuerpo_json"}
SECRETAS = {"c360_password_admin", "c360_password_analista", "c360_token"}


def leer(nombre):
    return json.loads((POSTMAN / nombre).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def coleccion():
    return leer("community360.postman_collection.json")


@pytest.fixture(scope="module")
def variables():
    return {v["key"]: v for v in leer("community360.postman_environment.json")["values"]}


def peticiones(nodo):
    for item in nodo["item"]:
        if "item" in item:
            yield from peticiones(item)
        else:
            yield item


def por_nombre(coleccion, texto):
    [item] = [i for i in peticiones(coleccion) if texto in i["name"]]
    return item


def test_el_entorno_no_lleva_secretos(variables):
    assert leer("community360.postman_environment.json")["name"] == "COMMUNITY 360"
    for nombre, v in variables.items():
        assert nombre.startswith("c360_")
        if nombre != "c360_base_url":
            assert v["value"] == "", f"{nombre} debe ir vacía"
    assert {n for n, v in variables.items() if v["type"] == "secret"} == SECRETAS


def test_la_coleccion_no_lleva_secretos(coleccion):
    texto = json.dumps(coleccion)
    assert "variable" not in coleccion  # nada de valores guardados en la colección
    assert not re.search(r"eyJ[\w-]+\.", texto)  # un JWT pegado por error
    assert all(i["response"] == [] for i in peticiones(coleccion))  # ni respuestas guardadas


def test_variables_usadas_y_declaradas_coinciden(coleccion, variables):
    texto = json.dumps(coleccion, ensure_ascii=False)
    usadas = set(re.findall(r"\{\{(.+?)\}\}", texto))
    usadas |= set(re.findall(r"pm\.\w+\.(?:get|set)\('(.+?)'", texto))
    assert usadas == set(variables) | LOCALES


def test_hay_una_peticion_por_endpoint(coleccion, settings_prueba):
    app = create_app(settings_prueba, BaseFalsa(), BaseFalsa())
    # Un parámetro de ruta ({id_usuario} en FastAPI, {{variable}} en Postman) cuenta como "{}"
    def normalizar(ruta):
        return re.sub(r"\{\{[^}]+\}\}|\{[^}]+\}", "{}", ruta)

    endpoints = {(m.upper(), normalizar(r)) for r, ms in app.openapi()["paths"].items() for m in ms}
    en_postman = {
        (i["request"]["method"], normalizar("/" + "/".join(i["request"]["url"]["path"])))
        for i in peticiones(coleccion)
    }
    assert en_postman == endpoints


def test_sin_token_no_manda_autorizacion_ni_cookies(coleccion):
    item = por_nombre(coleccion, "Sin token")
    assert item["request"]["auth"] == {"type": "noauth"}
    assert item["request"]["header"] == []
    assert item["protocolProfileBehavior"] == {"disableCookies": True}


def test_token_revocado_manda_el_token_guardado(coleccion):
    nombres = [i["name"] for i in peticiones(coleccion)]
    assert nombres.index("6. Logout (admin)") + 1 == nombres.index("7. Token revocado")
    assert "{{c360_token}}" in json.dumps(por_nombre(coleccion, "Token revocado")["request"]["auth"])


def test_fase_4_abre_su_propia_sesion(coleccion):
    # El token de la Fase 3 termina revocado: la carpeta de la Fase 4 inicia sesión antes
    [fase4] = [c for c in coleccion["item"] if c["name"] == "Fase 4 · Consultas"]
    nombres = [i["name"] for i in peticiones(fase4)]
    assert nombres[0] == "11. Login analista"
    assert nombres[-1].endswith(". Logout (analista)")
    # Numeración seguida, sin huecos, después de la Fase 3
    assert [int(n.split(".")[0]) for n in nombres] == list(range(11, 11 + len(nombres)))
    for texto in ("Catálogos", "Usuarios (página 1)", "Usuarios filtrados", "Usuario sin consentimiento"):
        assert "{{c360_token}}" in json.dumps(por_nombre(coleccion, texto)["request"]["auth"])


def test_usuario_sin_consentimiento_va_despues_de_la_lista(coleccion):
    nombres = [i["name"] for i in peticiones(coleccion)]
    assert nombres.index("13. Usuarios (página 1)") < nombres.index("15. Usuario sin consentimiento")
    detalle = por_nombre(coleccion, "Usuario sin consentimiento")
    assert detalle["request"]["url"]["path"] == ["api", "usuarios", "{{c360_id_sin_consentimiento}}"]
    assert "pm.execution.skipRequest()" in json.dumps(detalle["event"])


def test_limite_fuera_de_rango_espera_422(coleccion):
    item = por_nombre(coleccion, "Límite fuera de rango")
    assert item["request"]["url"]["query"] == [{"key": "limite", "value": "201"}]
    assert "have.status(422)" in json.dumps(item["event"])


def test_la_coleccion_exige_su_entorno(coleccion):
    [evento] = coleccion["event"]
    texto = "\n".join(evento["script"]["exec"])
    assert evento["listen"] == "prerequest"
    assert "pm.environment.name !== 'COMMUNITY 360'" in texto
    # Lanzar un error no detiene la petición; skipRequest sí
    assert "pm.execution.skipRequest()" in texto
    assert "throw " not in json.dumps(coleccion)


def test_el_crud_solo_toca_la_interaccion_que_creo(coleccion):
    [crud] = [c for c in coleccion["item"] if c["name"] == "Fase 4 · CRUD (admin)"]
    nombres = [i["name"] for i in crud["item"]]
    assert nombres[0].endswith("Login admin") and nombres[-1].endswith("Logout (admin)")
    crear = por_nombre(coleccion, "Crear interacción")
    assert "id_interaccion:" not in "".join(crear["event"][0]["script"]["exec"])  # el id lo pone el servidor
    for texto in ("Leer interacción", "Editar interacción", "Borrar interacción"):
        item = por_nombre(coleccion, texto)
        assert item["request"]["url"]["path"][-1] == "{{c360_id_interaccion}}"
        assert "pm.execution.skipRequest()" in json.dumps(item["event"])
