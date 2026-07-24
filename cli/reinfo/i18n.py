"""RO/EN message catalogue for CLI output."""

from __future__ import annotations

_MESSAGES: dict[str, dict[str, str]] = {
    "login_start": {
        "ro": "Se deschide browserul pentru autentificare...",
        "en": "Opening your browser to log in...",
    },
    "login_code": {
        "ro": "Codul tău: {code}",
        "en": "Your code: {code}",
    },
    "login_url": {
        "ro": "Dacă browserul nu s-a deschis, accesează: {url}",
        "en": "If your browser didn't open, visit: {url}",
    },
    "login_waiting": {
        "ro": "Se așteaptă confirmarea în browser...",
        "en": "Waiting for browser confirmation...",
    },
    "login_success": {
        "ro": "Conectat cu succes ca {username}.",
        "en": "Logged in successfully as {username}.",
    },
    "login_denied": {
        "ro": "Cererea de autentificare a fost refuzată.",
        "en": "The login request was denied.",
    },
    "login_expired": {
        "ro": "Codul a expirat. Încearcă din nou cu `reinfo login`.",
        "en": "The code expired. Try again with `reinfo login`.",
    },
    "not_logged_in": {
        "ro": "Nu ești autentificat. Rulează `reinfo login` mai întâi.",
        "en": "You're not logged in. Run `reinfo login` first.",
    },
    "logout_success": {
        "ro": "Deconectat.",
        "en": "Logged out.",
    },
    "submit_uploading": {
        "ro": "Se trimite soluția pentru {slug}...",
        "en": "Submitting solution for {slug}...",
    },
    "submit_judging": {
        "ro": "Se judecă...",
        "en": "Judging...",
    },
    "submit_done": {
        "ro": "Verdict: {verdict} · Scor: {score}",
        "en": "Verdict: {verdict} · Score: {score}",
    },
    "file_not_found": {
        "ro": "Fișierul {path} nu a fost găsit.",
        "en": "File {path} not found.",
    },
    "unsupported_language": {
        "ro": "Limbaj nesuportat: {lang}",
        "en": "Unsupported language: {lang}",
    },
    "init_done": {
        "ro": "Problema {slug} a fost inițializată în {path}",
        "en": "Problem {slug} scaffolded in {path}",
    },
    "problem_not_found": {
        "ro": "Problema {slug} nu a fost găsită.",
        "en": "Problem {slug} not found.",
    },
    "submission_not_found": {
        "ro": "Nicio submisie găsită.",
        "en": "No submission found.",
    },
    "api_error": {
        "ro": "Eroare API ({status}): {detail}",
        "en": "API error ({status}): {detail}",
    },
    "network_error": {
        "ro": "Nu s-a putut contacta {url}: {error}",
        "en": "Could not reach {url}: {error}",
    },
    "dataset_not_found": {
        "ro": "Problema {slug} nu are un set de date public.",
        "en": "Problem {slug} has no public dataset.",
    },
    "dataset_missing_columns": {
        "ro": "Coloane lipsă în DataFrame: {columns}",
        "en": "Missing columns in DataFrame: {columns}",
    },
    "dataset_wrong_row_count": {
        "ro": "Număr greșit de rânduri: aștept {expected}, primit {actual}.",
        "en": "Wrong row count: expected {expected}, got {actual}.",
    },
    "dataset_submit_timeout": {
        "ro": "Nu s-a primit un verdict în {timeout}s.",
        "en": "No verdict received within {timeout}s.",
    },
}


def t(key: str, locale: str = "ro", **kwargs: object) -> str:
    entry = _MESSAGES.get(key)
    if entry is None:
        return key
    template = entry.get(locale, entry.get("ro", key))
    return template.format(**kwargs)
