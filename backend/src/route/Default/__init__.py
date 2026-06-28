from fastapi import APIRouter
from src.route.Default import authRoute
from src.route.Default import profileRoute

router = APIRouter()
router.include_router(authRoute.router, prefix="/auth", tags=["auth"])
router.include_router(profileRoute.router, prefix="/profile", tags=["profile"])
