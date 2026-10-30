import base64
import hashlib
import hmac
import secrets
import time

from database import settings

SESSION_COOKIE = "techphones_admin"
SESSION_MAX_AGE = 8 * 60 * 60
PASSWORD_HASH_ITERATIONS = 600_000


def auth_is_configured() -> bool:
    return bool(settings.SESSION_SECRET and len(settings.SESSION_SECRET) >= 32)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, PASSWORD_HASH_ITERATIONS
    )
    return "$".join(
        (
            str(PASSWORD_HASH_ITERATIONS),
            base64.urlsafe_b64encode(salt).decode(),
            base64.urlsafe_b64encode(password_hash).decode(),
        )
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        iterations_text, salt_text, expected_hash_text = stored_hash.split("$", 2)
        iterations = int(iterations_text)
        if iterations < 1:
            return False
        salt = base64.urlsafe_b64decode(salt_text)
        expected_hash = base64.urlsafe_b64decode(expected_hash_text)
    except (ValueError, TypeError):
        return False

    actual_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return hmac.compare_digest(actual_hash, expected_hash)


def create_session_token(username: str) -> str:
    expires_at = int(time.time()) + SESSION_MAX_AGE
    payload = f"{username}\n{expires_at}".encode()
    encoded_payload = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    signature = hmac.new(
        settings.SESSION_SECRET.encode(), encoded_payload.encode(), hashlib.sha256
    ).hexdigest()
    return f"{encoded_payload}.{signature}"


def get_session_username(token: str | None) -> str | None:
    if not token or not auth_is_configured():
        return None

    try:
        encoded_payload, signature = token.rsplit(".", 1)
        expected_signature = hmac.new(
            settings.SESSION_SECRET.encode(), encoded_payload.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            return None

        payload_bytes = encoded_payload.encode()
        payload_bytes += b"=" * (-len(payload_bytes) % 4)
        username, expires_at = base64.urlsafe_b64decode(payload_bytes).decode().split("\n", 1)
        if int(expires_at) <= time.time():
            return None
    except (ValueError, UnicodeDecodeError):
        return None

    return username
