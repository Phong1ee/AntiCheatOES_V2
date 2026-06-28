from datetime import date

import src.models.default.profileModel as profileModel


class ProfileController:
    @staticmethod
    def _get_password_issues(password: str):
        issues = []
        if len(password) < 6:
            issues.append("Minimum 6 characters")
        if not any(char.isupper() for char in password):
            issues.append("At least 1 uppercase letter (A-Z)")
        if not any(char.isdigit() for char in password):
            issues.append("At least 1 number (0-9)")
        if password.isalnum():
            issues.append("At least 1 special character (e.g. !@#$%)")
        return issues

    @staticmethod
    def _normalize_profile_row(user: dict):
        date_of_birth = user["date_of_birth"]
        return {
            "id": user["id"],
            "school_id": user["school_id"],
            "studentId": user["school_id"],
            "fullName": user["full_name"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
            "phone": user["phone"] or "",
            "dateOfBirth": date_of_birth.isoformat() if date_of_birth else None,
        }

    @staticmethod
    def getProfile(school_id: str):
        """Get current user profile."""
        user = profileModel.getProfileBySchoolId(school_id)
        if not user:
            raise Exception("User not found")

        return {
            "success": True,
            "profile": ProfileController._normalize_profile_row(user),
        }

    @staticmethod
    def updateProfile(school_id: str, full_name: str, phone: str | None, date_of_birth: str | None):
        """Update editable profile fields only."""
        if not full_name or not full_name.strip():
            raise Exception("Full name is required")

        normalized_phone = phone.strip() if isinstance(phone, str) else None
        if normalized_phone == "":
            normalized_phone = None

        normalized_dob = None
        if date_of_birth:
            try:
                normalized_dob = date.fromisoformat(date_of_birth)
            except ValueError as e:
                raise Exception("Invalid dateOfBirth format, expected YYYY-MM-DD") from e

        row_count = profileModel.updateProfileBySchoolId(
            school_id,
            full_name.strip(),
            normalized_phone,
            normalized_dob,
        )
        if row_count == 0:
            raise Exception("User not found")

        user = profileModel.getProfileBySchoolId(school_id)
        if not user:
            raise Exception("User not found")

        return {
            "success": True,
            "message": "Profile updated successfully",
            "profile": ProfileController._normalize_profile_row(user),
        }

    @staticmethod
    def changePassword(school_id: str, current_password: str, new_password: str):
        """Change current user's password."""
        if not current_password:
            raise Exception("Current password is required")

        if not new_password:
            raise Exception("New password is required")

        user = profileModel.getProfileBySchoolId(school_id)
        if not user:
            raise Exception("User not found")

        if not profileModel.verifyCurrentPassword(school_id, current_password):
            raise Exception("Current password is incorrect")

        issues = ProfileController._get_password_issues(new_password)
        if issues:
            weak_error = Exception("New password does not meet the requirements.")
            setattr(weak_error, "issues", issues)
            raise weak_error

        row_count = profileModel.updatePasswordBySchoolId(school_id, new_password)
        if row_count == 0:
            raise Exception("User not found")

        return {
            "success": True,
            "message": "Password changed successfully",
        }
