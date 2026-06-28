from fastapi import HTTPException, Header, Depends, status
import jwt
from src.middleware.constant import SECRET_KEY, ALGORITHM

def verify_token(authorization: str = Header(None)):
    """Verify JWT token from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        token = parts[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return {
            "school_id": payload.get("sub"),
            "role": payload.get("role"),
            "exp": payload.get("exp")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
<<<<<<< HEAD
    except (ValueError, IndexError):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
=======
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
>>>>>>> duchuy_v2
