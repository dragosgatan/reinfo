import logging

import httpx

from app.config import settings

log = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"

# ro is the default locale, no path prefix (see frontend/src/i18n/routing.ts)
_RESET_PASSWORD_CONTENT = {
    "ro": {
        "locale_prefix": "",
        "subject": "Resetare parolă ReInfo",
        "body": "Ai cerut resetarea parolei pentru contul tău ReInfo.",
        "link_text": "Apasă aici pentru a-ți reseta parola",
        "expiry": "Acest link expiră într-o oră. Dacă nu ai cerut această resetare, poți ignora acest email.",
    },
    "en": {
        "locale_prefix": "en",
        "subject": "ReInfo password reset",
        "body": "You requested a password reset for your ReInfo account.",
        "link_text": "Click here to reset your password",
        "expiry": "This link expires in one hour. If you didn't request this, you can ignore this email.",
    },
    "hu": {
        "locale_prefix": "hu",
        "subject": "ReInfo jelszó visszaállítás",
        "body": "Jelszó-visszaállítást kértél a ReInfo fiókodhoz.",
        "link_text": "Kattints ide a jelszó visszaállításához",
        "expiry": "Ez a link egy óra múlva lejár. Ha nem te kérted, hagyd figyelmen kívül ezt az emailt.",
    },
}


async def send_password_reset_email(to_email: str, token: str, language: str) -> None:
    """send password reset email via resend, in the account's language; never raises, to avoid leaking whether the address exists"""
    if not settings.resend_api_key:
        log.warning("RESEND_API_KEY nu este configurată, emailul nu a fost trimis")
        return

    content = _RESET_PASSWORD_CONTENT.get(language, _RESET_PASSWORD_CONTENT["ro"])
    path = f"/{content['locale_prefix']}" if content["locale_prefix"] else ""
    reset_url = f"{settings.frontend_url}{path}/reset-password/{token}"
    html = f"""
        <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 4px;">{content["body"]}</p>
            <p style="margin: 0 0 4px;"><a href="{reset_url}">{content["link_text"]}</a></p>
            <p style="margin: 0; font-size: 0.85em; color: #666;">{content["expiry"]}</p>
        </div>
    """

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.email_from,
                    "to": [to_email],
                    "subject": content["subject"],
                    "html": html,
                },
            )
            response.raise_for_status()
    except httpx.HTTPError:
        log.exception("Trimiterea emailului de resetare a parolei a eșuat")


_VERIFY_EMAIL_CONTENT = {
    "ro": {
        "locale_prefix": "",
        "subject": "Confirmă adresa de email ReInfo",
        "body": "Bine ai venit pe ReInfo! Confirmă adresa de email pentru a-ți activa contul.",
        "link_text": "Apasă aici pentru a-ți confirma contul",
        "expiry": "Acest link expiră în 24 de ore. Dacă nu ai creat acest cont, poți ignora acest email.",
    },
    "en": {
        "locale_prefix": "en",
        "subject": "Confirm your ReInfo email",
        "body": "Welcome to ReInfo! Confirm your email address to activate your account.",
        "link_text": "Click here to confirm your account",
        "expiry": "This link expires in 24 hours. If you didn't create this account, you can ignore this email.",
    },
    "hu": {
        "locale_prefix": "hu",
        "subject": "Erősítsd meg a ReInfo email címedet",
        "body": "Üdvözlünk a ReInfo-n! Erősítsd meg az email címedet a fiókod aktiválásához.",
        "link_text": "Kattints ide a fiókod megerősítéséhez",
        "expiry": "Ez a link 24 óra múlva lejár. Ha nem te hoztad létre ezt a fiókot, hagyd figyelmen kívül ezt az emailt.",
    },
}


async def send_verification_email(to_email: str, token: str, language: str) -> None:
    """send account verification email via resend, in the account's language; never raises"""
    if not settings.resend_api_key:
        log.warning("RESEND_API_KEY nu este configurată, emailul nu a fost trimis")
        return

    content = _VERIFY_EMAIL_CONTENT.get(language, _VERIFY_EMAIL_CONTENT["ro"])
    path = f"/{content['locale_prefix']}" if content["locale_prefix"] else ""
    verify_url = f"{settings.frontend_url}{path}/verifica-email/{token}"
    html = f"""
        <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 4px;">{content["body"]}</p>
            <p style="margin: 0 0 4px;"><a href="{verify_url}">{content["link_text"]}</a></p>
            <p style="margin: 0; font-size: 0.85em; color: #666;">{content["expiry"]}</p>
        </div>
    """

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.email_from,
                    "to": [to_email],
                    "subject": content["subject"],
                    "html": html,
                },
            )
            response.raise_for_status()
    except httpx.HTTPError:
        log.exception("Trimiterea emailului de confirmare a eșuat")
