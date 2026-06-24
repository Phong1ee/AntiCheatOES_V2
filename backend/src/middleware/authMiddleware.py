from fastapi import HTTPException, Header
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
    except (ValueError, IndexError):
        raise HTTPException(status_code=401, detail="Invalid authorization header")