import logging

import httpx

from app.config import settings

log = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"

# ro is the default locale and has no path prefix (see frontend/src/i18n/routing.ts).
_RESET_PASSWORD_SECTIONS = [
    {
        "locale_prefix": "",
        "heading": "Română",
        "body": "Ai cerut resetarea parolei pentru contul tău ReInfo.",
        "link_text": "Apasă aici pentru a-ți reseta parola",
        "expiry": "Acest link expiră într-o oră. Dacă nu ai cerut această resetare, poți ignora acest email.",
    },
    {
        "locale_prefix": "en",
        "heading": "English",
        "body": "You requested a password reset for your ReInfo account.",
        "link_text": "Click here to reset your password",
        "expiry": "This link expires in one hour. If you didn't request this, you can ignore this email.",
    },
    {
        "locale_prefix": "hu",
        "heading": "Magyar",
        "body": "Jelszó-visszaállítást kértél a ReInfo fiókodhoz.",
        "link_text": "Kattints ide a jelszó visszaállításához",
        "expiry": "Ez a link egy óra múlva lejár. Ha nem te kérted, hagyd figyelmen kívül ezt az emailt.",
    },
]


async def send_password_reset_email(to_email: str, token: str) -> None:
    """Trimite emailul de resetare a parolei prin Resend, cu linkuri pentru fiecare limbă.

    Nu ridică excepții - un eșec la trimiterea emailului nu trebuie să
    dezvăluie apelantului dacă adresa există în baza de date. Emailul nu
    depinde de limba contului, pentru că cererea de resetare nu poartă
    context de locale (utilizatorul nu e autentificat).
    """
    if not settings.resend_api_key:
        log.warning("RESEND_API_KEY nu este configurată, emailul nu a fost trimis")
        return

    sections = []
    for section in _RESET_PASSWORD_SECTIONS:
        path = f"/{section['locale_prefix']}" if section["locale_prefix"] else ""
        reset_url = f"{settings.frontend_url}{path}/reset-password/{token}"
        sections.append(f"""
            <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 4px; font-weight: 600;">{section["heading"]}</p>
                <p style="margin: 0 0 4px;">{section["body"]}</p>
                <p style="margin: 0 0 4px;"><a href="{reset_url}">{section["link_text"]}</a></p>
                <p style="margin: 0; font-size: 0.85em; color: #666;">{section["expiry"]}</p>
            </div>
        """)
    html = "".join(sections)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.email_from,
                    "to": [to_email],
                    "subject": "Resetare parolă ReInfo / Password reset / Jelszó visszaállítás",
                    "html": html,
                },
            )
            response.raise_for_status()
    except httpx.HTTPError:
        log.exception("Trimiterea emailului de resetare a parolei a eșuat")
