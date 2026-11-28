"""Configuración del backend. Todo se lee de backend/.env (o de variables de entorno)."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

RUTA_ENV = Path(__file__).resolve().parent.parent / ".env"
# Build del frontend (npm run build). En Docker queda en el mismo lugar relativo
RUTA_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


class Settings(BaseSettings):
    # hide_input_in_errors evita que un error de validación imprima credenciales
    model_config = SettingsConfigDict(
        env_file=RUTA_ENV,
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    # TiDB Cloud
    TIDB_HOST: str = Field(min_length=1)
    TIDB_PORT: int = 4000
    TIDB_USER: str = Field(min_length=1)
    TIDB_PASSWORD: SecretStr = Field(min_length=1)
    TIDB_DB: str = "community360"

    # Couchbase Capella
    CB_CONN: str = Field(min_length=1)
    CB_USER: str = Field(min_length=1)
    CB_PASSWORD: SecretStr = Field(min_length=1)
    CB_BUCKET: str = "Community360"
    CB_SCOPE: str = "app"

    # Autenticación (HS256 necesita una clave de al menos 32 caracteres)
    JWT_SECRET: SecretStr = Field(min_length=32)
    JWT_MINUTOS: int = Field(default=60, gt=0)
    FRONTEND_ORIGEN: str = "http://localhost:5173"

    # Despliegue: en Render (https) la cookie de sesión lleva Secure
    COOKIE_SECURE: bool = False
    FRONTEND_DIST: Path = RUTA_DIST


class ErrorConfiguracion(RuntimeError):
    """Falta una variable o no es válida. El mensaje solo lleva nombres, nunca valores."""


def cargar_settings(**opciones) -> Settings:
    try:
        return Settings(**opciones)
    except ValidationError as e:
        nombres = ", ".join(sorted({str(error["loc"][0]) for error in e.errors()}))
        # "from None" quita el error original de la traza
        raise ErrorConfiguracion(f"Revisa estas variables en backend/.env: {nombres}") from None


@lru_cache
def get_settings() -> Settings:
    return cargar_settings()
