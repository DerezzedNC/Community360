"""Contraseñas (hash Argon2) y formato del correo de las cuentas de usuario_admin."""
from email_validator import EmailNotValidError, validate_email
from pwdlib import PasswordHash
from pwdlib.exceptions import PwdlibError

LARGO_MINIMO_PASSWORD = 12

_hasher = PasswordHash.recommended()  # Argon2id con sal aleatoria


def crear_hash(password: str) -> str:
    return _hasher.hash(password)


def verificar_password(password: str, password_hash: str) -> bool:
    """True si coinciden. Un hash dañado o un texto inválido dan False, no un error."""
    try:
        return _hasher.verify(password, password_hash)
    except (PwdlibError, UnicodeError):
        return False


def normalizar_correo(correo: str) -> str:
    """Correo en minúsculas y sin espacios alrededor. ValueError si el formato no es válido.

    Solo se aceptan caracteres sin acento: la columna correo compara sin distinguir acentos
    y dos correos distintos podrían confundirse.
    """
    try:
        valido = validate_email(
            correo.strip(), check_deliverability=False, allow_smtputf8=False
        )
    except EmailNotValidError:
        raise ValueError("El correo no tiene un formato válido") from None
    return valido.ascii_email.lower()
