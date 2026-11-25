import pytest

from app.seguridad import crear_hash, normalizar_correo, verificar_password

PASSWORD = "clave de prueba ñ 123"


def test_el_hash_no_contiene_la_password_y_cabe_en_la_columna():
    h = crear_hash(PASSWORD)
    assert h.startswith("$argon2id$")
    assert PASSWORD not in h
    assert len(h) <= 255


def test_cada_hash_es_distinto():
    assert crear_hash(PASSWORD) != crear_hash(PASSWORD)


def test_verificar_password():
    h = crear_hash(PASSWORD)
    assert verificar_password(PASSWORD, h) is True
    assert verificar_password(PASSWORD + "x", h) is False
    assert verificar_password("", h) is False


@pytest.mark.parametrize(
    "danado", ["", "texto", PASSWORD, "$argon2id$roto", "$argon2id$v=19$m=65536,t=3,p=4$abc$def"]
)
def test_hash_danado_da_false(danado):
    assert verificar_password(PASSWORD, danado) is False


def test_password_con_texto_invalido_da_false():
    assert verificar_password("\ud800", crear_hash(PASSWORD)) is False


def test_normalizar_correo():
    assert normalizar_correo("  Admin@Community360.MX ") == "admin@community360.mx"


@pytest.mark.parametrize("correo", ["", "admin", "admin@", "@x.mx", "a b@x.mx", "josé@x.mx"])
def test_correo_invalido(correo):
    with pytest.raises(ValueError):
        normalizar_correo(correo)
