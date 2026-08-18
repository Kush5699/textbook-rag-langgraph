from fastapi import APIRouter, Depends, Request
import aiosqlite
from ..database import get_db
from ..models import UserResponse
from .service import get_current_user

router = APIRouter()


@router.post("/sync", response_model=UserResponse)
async def sync(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    """
    Sync the currently authenticated Firebase user to the local database.
    Called by the frontend after Firebase login/register.
    Creates a new local user record on first call (first user = admin).
    Returns the user profile with role.
    """
    user = await get_current_user(request, db)
    return UserResponse(
        id=user["id"],
        email=user["email"],
        role=user["role"],
        created_at=user.get("created_at", ""),
    )


@router.get("/me", response_model=UserResponse)
async def me(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    """Get current user profile."""
    user = await get_current_user(request, db)
    return UserResponse(
        id=user["id"],
        email=user["email"],
        role=user["role"],
        created_at=user.get("created_at", ""),
    )
