import jwt
from datetime import datetime, timedelta
import src.models.userModel as userModel
from src.middleware.constant import SECRET_KEY, ALGORITHM

class AuthController:
    @staticmethod
    def create_token(school_id: str, role: str):
        """Create a JWT token for the authenticated user."""
        payload = {
            "sub": school_id,
            "role": role,
            "exp": datetime.utcnow() + timedelta(hours=24)  # Token expires in 24 hours
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token
    
    @staticmethod
    def login(email: str, password:str):
        """Authenticate user and return a JWT token if successful."""
        user = userModel.verifyUser(email, password)
        if not user:
            raise Exception("Invalid email or password")
        
        token = AuthController.create_token(user[4], user[2])  # user[4] is school_id, user[2] is role
        return {
            "success": True,
            "message": "Login successful",
            "user": {
                "full_name": user[0],
                "email": user[1],
                "role": user[2],
                "school_id": user[4]
            },
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
    
    #Nghiên cứu về cách quản lý phiên làm việc và token để có thể thực hiện logout hiệu quả hơn
    @staticmethod
    def logout(): 
        """Handle user logout (for stateless JWT, this is just a placeholder)."""
        return {
            "success": True,
            "message": "Logged out successfully"
        }