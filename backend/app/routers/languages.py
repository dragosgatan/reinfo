"""Public language catalogue - single source of truth shared with the frontend selector."""

from fastapi import APIRouter

from app.languages import LANGUAGES
from app.schemas.language import LanguageRead

router = APIRouter(prefix="/api/languages", tags=["languages"])


@router.get("", response_model=list[LanguageRead])
async def list_languages() -> list[LanguageRead]:
    """Toate limbajele cunoscute de judge, inclusiv cele experimentale/blocate."""
    return [LanguageRead.model_validate(lang) for lang in LANGUAGES]
