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
