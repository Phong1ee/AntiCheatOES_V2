import jwt
from datetime import datetime, timedelta
import src.models.userModel as userModel

SECRET_KEY = "HASQEWQEO!LNDALSDASLKDN"  # In production, use a secure method to store this key
ALGORITHM = "HS256"

class AuthController:
    @staticmethod
    def create_token(email: str, role: str):
        """Create a JWT token for the authenticated user."""
        payload = {
            "sub": email,
            "role": role,
            "exp": datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token
    
    @staticmethod
    def login(email: str, password:str):
        """Authenticate user and return a JWT token if successful."""
        user = userModel.verifyUser(email, password)
        if not user:
            raise Exception("Invalid email or password")
        
        token = AuthController.create_token(user[1], user[2])  # user[1] is email, user[2] is role
        return {
            "success": True,
            "message": "Login successful",
            "user": user,
            "token": token
        }
        
    @staticmethod
    def register(fullname: str, email: str, password:str, role:str):
        """Register a new user."""
        userModel.registerUser(fullname, email, password, role)
        return {
            "success": True,
            "message": "Registration successful"
        }