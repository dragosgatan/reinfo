import secrets

import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def _normalize_flag(flag: str, case_sensitive: bool) -> str:
    return flag if case_sensitive else flag.lower()


def hash_flag(flag: str, case_sensitive: bool) -> str:
    """Hash a CTF flag for storage. The plaintext is never persisted."""
    normalized = _normalize_flag(flag, case_sensitive)
    return bcrypt.hashpw(normalized.encode(), bcrypt.gensalt()).decode()


def verify_flag(submitted: str, flag_hash: str, case_sensitive: bool) -> bool:
    normalized = _normalize_flag(submitted, case_sensitive)
    return bcrypt.checkpw(normalized.encode(), flag_hash.encode())
