"""Da de alta una cuenta en usuario_admin (TiDB).

Uso, desde backend/ y en una ventana de PowerShell:
    .venv/Scripts/python -m scripts.crear_admin

Todo se pide por consola. La contraseña no se muestra, no se recibe como argumento y solo
se guarda su hash Argon2.
"""
import sys
import warnings
from collections.abc import Callable
from getpass import GetPassWarning, getpass

from app.config import ErrorConfiguracion, get_settings
from app.db.tidb import TiDB
from app.repositorios import usuario_admin
from app.seguridad import (
    LARGO_MAXIMO_PASSWORD,
    LARGO_MINIMO_PASSWORD,
    crear_hash,
    normalizar_correo,
)
from app.tokens import ROLES

LARGO_CORREO = 120  # tamaños de las columnas en TiDB
LARGO_NOMBRE = 80


def validar_correo(texto: str) -> str:
    correo = normalizar_correo(texto)
    if len(correo) > LARGO_CORREO:
        raise ValueError(f"El correo admite como máximo {LARGO_CORREO} caracteres")
    return correo


def validar_nombre(texto: str) -> str:
    nombre = texto.strip()
    if not nombre or len(nombre) > LARGO_NOMBRE or not nombre.isprintable():
        raise ValueError(f"El nombre debe tener de 1 a {LARGO_NOMBRE} caracteres")
    return nombre


def validar_rol(texto: str) -> str:
    rol = texto.strip().lower()
    if rol not in ROLES:
        raise ValueError("El rol debe ser admin o analista")
    return rol


def validar_password(password: str) -> str:
    if len(password) < LARGO_MINIMO_PASSWORD:
        raise ValueError(f"La contraseña debe tener al menos {LARGO_MINIMO_PASSWORD} caracteres")
    # El login no acepta más que esto; una cuenta más larga no podría entrar
    if len(password) > LARGO_MAXIMO_PASSWORD:
        raise ValueError(f"La contraseña admite como máximo {LARGO_MAXIMO_PASSWORD} caracteres")
    # Un pegado que falla en la consola puede meter caracteres de control que no se ven
    if not password.isprintable():
        raise ValueError("La contraseña tiene caracteres no válidos; escríbela a mano")
    return password


def pedir(leer: Callable[[str], str], mensaje: str, validar: Callable[[str], str]) -> str:
    """Pregunta hasta que el dato sea válido (Ctrl+C cancela)."""
    while True:
        texto = leer(mensaje)
        try:
            return validar(texto)
        except ValueError as e:
            print(f"  {e}")


def pedir_password(leer_password: Callable[[str], str]) -> str:
    while True:
        password = pedir(
            leer_password,
            f"Contraseña (mínimo {LARGO_MINIMO_PASSWORD} caracteres, no se ve al escribir): ",
            validar_password,
        )
        if leer_password("Repite la contraseña: ") == password:
            return password
        print("  Las contraseñas no coinciden")


def ejecutar(
    tidb: TiDB, leer: Callable[[str], str], leer_password: Callable[[str], str]
) -> int:
    """Devuelve el código de salida: 0 si se creó la cuenta, 1 si no."""
    try:
        correo = pedir(leer, "Correo: ", validar_correo)
        # Se revisa antes de pedir lo demás; así también se sabe si TiDB responde
        with tidb.conexion() as con:
            repetido = usuario_admin.buscar_por_correo(con, correo) is not None
        if repetido:
            raise usuario_admin.CorreoRepetido
        nombre = pedir(leer, "Nombre: ", validar_nombre)
        rol = pedir(leer, "Rol (admin o analista): ", validar_rol)
        password_hash = crear_hash(pedir_password(leer_password))
        id_admin = usuario_admin.insertar(tidb, correo, nombre, password_hash, rol)
    except usuario_admin.CorreoRepetido:
        print("Ya existe una cuenta con ese correo. No se modificó nada.")
        return 1
    except (KeyboardInterrupt, EOFError):
        print("\nCancelado.")
        return 1
    except GetPassWarning:
        print("Esta terminal no puede ocultar la contraseña. Usa una ventana de PowerShell.")
        return 1
    except Exception as e:
        # Solo el tipo: el mensaje puede traer usuario y servidor
        print(f"No se pudo completar el alta ({type(e).__name__}). Vuelve a correr el script;")
        print("si dice que el correo ya existe, la cuenta sí se guardó.")
        return 1
    print(f"Cuenta creada: id_admin={id_admin} · {correo} · {rol}")
    return 0


def main() -> int:
    if not sys.stdin.isatty():
        print("Corre este script en una ventana de PowerShell, no desde otro programa.")
        return 1
    # Si getpass no puede ocultar lo que se escribe, se detiene en lugar de mostrarlo
    warnings.simplefilter("error", GetPassWarning)
    try:
        settings = get_settings()
    except ErrorConfiguracion as e:
        print(e)
        return 1
    return ejecutar(TiDB(settings), input, getpass)


if __name__ == "__main__":
    sys.exit(main())
