from __future__ import annotations

import secrets

from fastapi import APIRouter, HTTPException, Request, UploadFile, status

from app.media.constants import ALLOWED_TYPES, MAX_BYTES, UPLOAD_DIR

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_media(file: UploadFile, request: Request) -> dict[str, str]:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"unsupported type: {content_type}",
        )

    ext = ALLOWED_TYPES[content_type]
    name = f"{secrets.token_urlsafe(12)}{ext}"
    dest = UPLOAD_DIR / name

    size = 0
    with dest.open("wb") as out:
        while chunk := await file.read(64 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    "file too large",
                )
            out.write(chunk)

    public_path = f"/media/{name}"
    return {
        "url": public_path,
        "absolute_url": str(request.base_url).rstrip("/") + public_path,
        "content_type": content_type,
        "size": str(size),
    }
