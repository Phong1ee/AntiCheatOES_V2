from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.controller.default.profileController import ProfileController
from src.middleware.authMiddleware import verify_token

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    fullName: str
    phone: str | None = None
    dateOfBirth: str | None = None


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


@router.get("/me")
async def get_profile_me(current_user: dict = Depends(verify_token)):
    """Get current user profile."""
    try:
        return ProfileController.getProfile(current_user["school_id"])
    except Exception as e:
        detail = str(e)
        if detail == "User not found":
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.put("/me")
async def update_profile_me(
    request: UpdateProfileRequest,
    current_user: dict = Depends(verify_token),
):
    """Update current user profile."""
    try:
        return ProfileController.updateProfile(
            current_user["school_id"],
            request.fullName,
            request.phone,
            request.dateOfBirth,
        )
    except Exception as e:
        detail = str(e)
        if detail == "User not found":
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.put("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(verify_token),
):
    """Change current user password."""
    try:
        return ProfileController.changePassword(
            current_user["school_id"],
            request.currentPassword,
            request.newPassword,
        )
    except Exception as e:
        detail = str(e)
        if detail == "User not found":
            raise HTTPException(status_code=404, detail=detail)

        issues = getattr(e, "issues", None)
        if issues:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": detail,
                    "issues": issues,
                },
            )

        raise HTTPException(status_code=400, detail=detail)
