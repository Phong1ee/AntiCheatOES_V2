from pydantic import BaseModel


class UpdateProfileRequest(BaseModel):
    fullName: str
    phone: str | None = None
    dateOfBirth: str | None = None


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str
