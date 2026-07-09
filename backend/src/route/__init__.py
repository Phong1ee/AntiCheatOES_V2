from fastapi import APIRouter
from src.route import authRoute
from src.route import profileRoute

router = APIRouter()
router.include_router(authRoute.router, prefix="/auth", tags=["auth"])
router.include_router(profileRoute.router, prefix="/profile", tags=["profile"])
