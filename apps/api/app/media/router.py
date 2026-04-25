from __future__ import annotations

import io
import secrets

from fastapi import APIRouter, HTTPException, Request, UploadFile, status

from app.core.config import settings
from app.media.constants import ALLOWED_TYPES, MAX_BYTES, UPLOAD_DIR
from app.media.schemas import MediaUploadResponse

router = APIRouter(prefix="/media", tags=["media"])


def _s3_client():
    import boto3  # imported lazily so dev environments without AWS creds still boot

    return boto3.client("s3", region_name=settings.s3_region)


@router.post("/upload", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(file: UploadFile, request: Request) -> MediaUploadResponse:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"unsupported type: {content_type}",
        )

    ext = ALLOWED_TYPES[content_type]
    name = f"{secrets.token_urlsafe(12)}{ext}"

    buffer = io.BytesIO()
    size = 0
    try:
        while chunk := await file.read(64 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    "file too large",
                )
            buffer.write(chunk)
    finally:
        await file.close()

    buffer.seek(0)

    if settings.s3_bucket_name:
        # Cloud path: upload to S3, return the public URL.
        key = f"{settings.s3_media_prefix.strip('/')}/{name}"
        try:
            _s3_client().upload_fileobj(
                buffer,
                settings.s3_bucket_name,
                key,
                ExtraArgs={"ContentType": content_type},
            )
        except Exception as exc:  # pragma: no cover — surface to caller
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"S3 upload failed: {exc}") from exc

        public_url = f"https://{settings.s3_bucket_name}.s3.{settings.s3_region}.amazonaws.com/{key}"
        return MediaUploadResponse(
            url=public_url,
            absolute_url=public_url,
            content_type=content_type,
            size=size,
        )

    # Local fallback: write to disk, return same-origin path served via FastAPI StaticFiles.
    dest = UPLOAD_DIR / name
    try:
        with dest.open("wb") as out:
            out.write(buffer.getbuffer())
    except Exception:
        dest.unlink(missing_ok=True)
        raise

    public_path = f"/media/{name}"
    return MediaUploadResponse(
        url=public_path,
        absolute_url=str(request.base_url).rstrip("/") + public_path,
        content_type=content_type,
        size=size,
    )
