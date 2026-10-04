from pydantic import BaseModel, Field, model_validator
from src.service.rich_content_service import sanitize_rich


class RichContentRequest(BaseModel):
    rich_html: str | None = Field(default=None, max_length=60000)
    image_media_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    audio_media_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    image_alt: str = Field(default="", max_length=300)
    semantic_value: str | None = Field(default=None, pattern=r"^(true|false)$")

    @model_validator(mode="after")
    def clean(self):
        clean_html, plain = sanitize_rich(self.rich_html)
        object.__setattr__(self, "rich_html", clean_html)
        if plain is not None:
            if hasattr(self, "question_text"):
                object.__setattr__(self, "question_text", plain)
                self.model_fields_set.add("question_text")
            if hasattr(self, "options_text"):
                object.__setattr__(self, "options_text", plain)
                self.model_fields_set.add("options_text")
        return self
