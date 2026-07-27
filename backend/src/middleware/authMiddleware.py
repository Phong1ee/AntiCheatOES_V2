from fastapi import HTTPException, Header, Depends, status
import jwt
from sqlalchemy.orm import Session

from database import get_db
from src.a_db_config import User
from src.middleware.constant import SECRET_KEY, ALGORITHM

def _role_value(role: object) -> str:
    return role.value if hasattr(role, "value") else str(role or "")


def verify_token(
    authorization: str = Header(None),
    db: Session = Depends(get_db),
):
    """Verify a token and resolve the account's current database state."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        token = parts[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        school_id = payload.get("sub")
        if not school_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = db.query(User).filter(User.school_id == school_id).first()
        if not user or user.deleted_at is not None or user.is_locked:
            raise HTTPException(status_code=401, detail="Account is unavailable")

        return {
            "id": user.id,
            "school_id": user.school_id,
            # Never trust a role claim after the token has been issued.
            "role": _role_value(user.role).lower(),
            "exp": payload.get("exp")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header")

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = [role.lower() for role in allowed_roles]

    def __call__(self, current_user: dict = Depends(verify_token)):
        user_role = current_user.get("role", "").lower()
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource"
            )
        return current_user

ADMIN_ONLY = RoleChecker(allowed_roles=["admin"])
STUDENT_ONLY = RoleChecker(allowed_roles=["student"])
TEACHER_ONLY = RoleChecker(allowed_roles=["teacher"])
