import hashlib
import secrets

import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def generate_api_token() -> str:
    """a recognizable, high-entropy cli token, e.g. reinfo_<43 url-safe chars>"""
    return f"reinfo_{secrets.token_urlsafe(32)}"


def hash_token(token: str) -> str:
    """sha-256 hash for cli api tokens and device codes"""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_user_code() -> str:
    """short human-typeable device-auth code, e.g. wdjb-mjht"""
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

    def part() -> str:
        return "".join(secrets.choice(alphabet) for _ in range(4))

    return f"{part()}-{part()}"


def _normalize_flag(flag: str, case_sensitive: bool) -> str:
    return flag if case_sensitive else flag.lower()


def hash_flag(flag: str, case_sensitive: bool) -> str:
    """hash a ctf flag for storage, the plaintext is never persisted"""
    normalized = _normalize_flag(flag, case_sensitive)
    return bcrypt.hashpw(normalized.encode(), bcrypt.gensalt()).decode()


def verify_flag(submitted: str, flag_hash: str, case_sensitive: bool) -> bool:
    normalized = _normalize_flag(submitted, case_sensitive)
    return bcrypt.checkpw(normalized.encode(), flag_hash.encode())
