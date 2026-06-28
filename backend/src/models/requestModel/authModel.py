from enum import Enum
from typing import List
from pydantic import BaseModel
from src.middleware.authMiddleware import RoleChecker

# Define your roles
class Role(str, Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "STUDENT"

# Mock User Model
class User(BaseModel):
    username: str
    email: str
    roles: List[Role]  # A user can have multiple roles

ADMIN_ONLY= RoleChecker(allowed_roles=["admin"])
STUDENT_ONLY = RoleChecker(allowed_roles=["student"])
TEACHER_ONLY = RoleChecker(allowed_roles=["teacher"])   