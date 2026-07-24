from pydantic import BaseModel, ConfigDict


class LanguageRead(BaseModel):
    """public-facing language metadata for the frontend selector, monaco, and starter code"""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    display_name: str
    monaco_id: str
    file_name: str
    starter_template: str
    version: str
    stable: bool
    blocked_reason: str | None
