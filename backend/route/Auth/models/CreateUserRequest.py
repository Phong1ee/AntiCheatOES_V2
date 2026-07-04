from pydantic import BaseModel

class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str