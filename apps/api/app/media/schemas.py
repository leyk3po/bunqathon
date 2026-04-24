from pydantic import BaseModel


class MediaUploadResponse(BaseModel):
    url: str
    absolute_url: str
    content_type: str
    size: int
