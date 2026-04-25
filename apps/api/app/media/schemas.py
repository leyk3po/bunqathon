from pydantic import BaseModel


class MediaUploadResponse(BaseModel):
    model_config = {
        "json_schema_extra": {
            "example": {
                "url": "/media/demo-image.jpg",
                "absolute_url": "http://127.0.0.1:8000/media/demo-image.jpg",
                "content_type": "image/jpeg",
                "size": 183442,
            }
        }
    }

    url: str
    absolute_url: str
    content_type: str
    size: int
