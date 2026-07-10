import jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, Depends, status
import src.models.userModel as userModel
from src.middleware.constant import SECRET_KEY, ALGORITHM
#from src.middleware.authMiddleware import RoleChecker, ADMIN_ONLY, STUDENT_ONLY, TEACHER_ONLY

class AuthController:
    @staticmethod
    def normalize_role(role: str):
        normalized_role = role.strip().lower()
        allowed_roles = {"student", "teacher", "admin"}
        if normalized_role not in allowed_roles:
            raise Exception("Role must be one of: student, teacher, admin")
        return normalized_role

    @staticmethod
    def create_token(school_id: str, role: str):
        """Create a JWT token for the authenticated user."""
        payload = {
            "sub": school_id,
            "role": role,
            "exp": datetime.utcnow() + timedelta(hours=24)
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token

    @staticmethod
    def login(email: str, password: str):
        """Authenticate user and return a JWT token if successful."""
        user = userModel.verifyUser(email, password)
        if not user:
            raise Exception("Invalid email or password")

        role = AuthController.normalize_role(user[3])
        token = AuthController.create_token(user[5], role)
        return {
            "success": True,
            "message": "Login successful",
            "token": token,
            "user": {
                "id": user[0],
                "school_id": user[5],
                "full_name": user[1],
                "email": user[2],
                "role": role
            },
        }

    @staticmethod
    def register(fullname: str, email: str, password: str, role: str):
        """Register a new user."""
        normalized_role = AuthController.normalize_role(role)
        userModel.registerUser(fullname, email, password, normalized_role)
        return {
            "success": True,
            "message": "Registration successful"
        }

    @staticmethod
    def get_me(school_id: str):
        """Get current user profile by school_id from token."""
        user = userModel.getUserBySchoolId(school_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        role = AuthController.normalize_role(user["role"])
        date_of_birth = user["date_of_birth"]

        return {
            "success": True,
            "user": {
                "id": user["id"],
                "school_id": user["school_id"],
                "full_name": user["full_name"],
                "fullname": user["full_name"],
                "email": user["email"],
                "role": role,
                "phone": user["phone"],
                "date_of_birth": date_of_birth.isoformat() if date_of_birth else None
            }
        }

    @staticmethod
    def logout():
        """Handle user logout (for stateless JWT, this is just a placeholder)."""
        return {
            "success": True,
            "message": "Logged out successfully"
        }
