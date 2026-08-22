"""Upload, serve and remove the signed-in user's avatar.

The bytes live in user.avatar_image (MEDIUMBLOB) and are deliberately not part
of any profile JSON: the profile payload stays small, and the picture is fetched
only by the browser that renders it, which can cache it.

Every endpoint here acts on the caller's own row - the school_id comes from the
token, never from the path - so no user can read or overwrite another's avatar.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session, undefer

from database import get_db
from src.a_db_config import User
from src.middleware.authMiddleware import verify_token


router = APIRouter()

# An avatar renders at 96px at most. 1 MB is already generous, and the bytes are
# served on every page load, so the cap is deliberately tighter than a question
# image's - there is no server-side downscaling to fall back on.
MAX_AVATAR_SIZE = 1024 * 1024
# Checked against the file's own leading bytes: a caller-supplied content type is
# a claim, not evidence, and these bytes are served back to a browser.
_MAGIC_NUMBERS = (
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
)


def _sniff_image_type(content: bytes) -> str | None:
    for prefix, media_type in _MAGIC_NUMBERS:
        if content.startswith(prefix):
            return media_type
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def _me(db: Session, school_id: str, with_image: bool = False) -> User:
    query = db.query(User).filter(User.school_id == school_id)
    if with_image:
        query = query.options(undefer(User.avatar_image))
    user = query.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me/avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Set or replace the caller's avatar."""
    user = _me(db, current_user["school_id"])
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty")
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=413, detail="The image must be 1 MB or smaller")
    media_type = _sniff_image_type(content)
    if media_type is None:
        raise HTTPException(status_code=422, detail="Upload a PNG, JPEG, WebP or GIF image")
    try:
        user.avatar_image = content
        user.avatar_mime = media_type
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"success": True, "content_type": media_type, "size": len(content)}


@router.delete("/me/avatar", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_avatar(
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Remove the caller's avatar, falling the UI back to the generated one."""
    user = _me(db, current_user["school_id"])
    try:
        user.avatar_image = None
        user.avatar_mime = None
        db.commit()
    except Exception:
        db.rollback()
        raise
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/avatar")
def get_my_avatar(
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Serve the caller's own avatar bytes."""
    user = _me(db, current_user["school_id"], with_image=True)
    if not user.avatar_mime or not user.avatar_image:
        raise HTTPException(status_code=404, detail="No avatar has been uploaded")
    return Response(
        content=user.avatar_image,
        media_type=user.avatar_mime,
        # Private: this is one user's picture, never a shared cache's to hold.
        # Short-lived so a replacement shows up without a hard refresh.
        headers={"Cache-Control": "private, max-age=60"},
    )
