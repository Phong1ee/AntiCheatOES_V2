from fastapi import APIRouter, Depends, HTTPException
from src.controller.resultsController import ResultsController
from src.middleware.authMiddleware import verify_token


router = APIRouter()


@router.get("")
async def get_results(current_user: dict = Depends(verify_token)):
    try:
        return ResultsController.get_results(
            current_user["school_id"],
            current_user["role"],
        )
    except Exception as e:
        detail = str(e)
        if detail == "Only students can view results":
            raise HTTPException(status_code=403, detail=detail)
        if detail == "User not found":
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@router.get("/{attempt_id}")
async def get_result_detail(attempt_id: int, current_user: dict = Depends(verify_token)):
    try:
        return ResultsController.get_result_detail(
            current_user["school_id"],
            current_user["role"],
            attempt_id,
        )
    except Exception as e:
        detail = str(e)
        if detail == "Only students can view results":
            raise HTTPException(status_code=403, detail=detail)
        if detail in {"User not found", "Result not found"}:
            raise HTTPException(status_code=404, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
