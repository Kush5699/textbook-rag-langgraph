from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel, EmailStr
import aiosqlite
import socket
import re
from ..database import get_db
from ..models import UserResponse
from .service import get_current_user

router = APIRouter()


class EmailValidationRequest(BaseModel):
    email: str


DISPOSABLE_DOMAINS = {
    "tempmail.com", "10minutemail.com", "guerrillamail.com", "sharklasers.com",
    "mailinator.com", "dispostable.com", "yopmail.com", "throwawaymail.com",
    "fakeinbox.com", "getairmail.com", "mohmal.com", "crazymailing.com",
    "inboxkitten.com", "generator.email", "trashmail.com", "nada.ltd"
}


@router.post("/validate-email")
async def validate_email_endpoint(payload: EmailValidationRequest):
    """
    Validates email format, verifies it is not disposable,
    and checks if the domain actually exists via DNS lookup.
    """
    email = payload.email.strip().lower()
    email_regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not re.match(email_regex, email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email syntax. Please enter a valid email address.",
        )

    domain = email.split("@")[1]
    if domain in DISPOSABLE_DOMAINS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Disposable and temporary email addresses are not permitted.",
        )

    # Perform DNS resolution to ensure the domain actually exists on the internet
    try:
        # Check SMTP or HTTP port on domain
        socket.getaddrinfo(domain, 80)
    except socket.gaierror:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The domain '@{domain}' does not exist. Please use a real email address.",
        )
    except Exception as e:
        # If lookup failed for network reasons, allow fallback but warn
        pass

    return {"valid": True, "email": email}


@router.post("/sync", response_model=UserResponse)
async def sync(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    """
    Sync the currently authenticated Firebase user to the local database.
    Called by the frontend after Firebase login/register.
    Creates a new local user record on first call (first user = admin).
    Returns the user profile with role, username, and name.
    """
    user = await get_current_user(request, db)
    return UserResponse(
        id=user["id"],
        email=user["email"],
        role=user["role"],
        name=user.get("name", ""),
        username=user.get("username", ""),
        standard=user.get("standard", ""),
        school=user.get("school", ""),
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
        name=user.get("name", ""),
        username=user.get("username", ""),
        standard=user.get("standard", ""),
        school=user.get("school", ""),
        created_at=user.get("created_at", ""),
    )


from ..models import UserProfileUpdate

@router.put("/profile", response_model=UserResponse)
async def update_profile(
    payload: UserProfileUpdate,
    request: Request,
    db: aiosqlite.Connection = Depends(get_db)
):
    """Update user profile fields (name, username, standard, school)."""
    user = await get_current_user(request, db)
    user_id = user["id"]

    updates = []
    params = []

    if payload.name is not None:
        updates.append("name = ?")
        params.append(payload.name.strip())
    if payload.username is not None:
        new_username = payload.username.strip().lower()
        # Ensure username isn't taken by another user
        async with db.execute(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            (new_username, user_id)
        ) as cursor:
            if await cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This username is already taken. Please choose another."
                )
        updates.append("username = ?")
        params.append(new_username)
    if payload.standard is not None:
        updates.append("standard = ?")
        params.append(payload.standard.strip())
    if payload.school is not None:
        updates.append("school = ?")
        params.append(payload.school.strip())

    if updates:
        params.append(user_id)
        await db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()

    # Return refreshed user record
    async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        updated = await cursor.fetchone()

    return UserResponse(
        id=updated["id"],
        email=updated["email"],
        role=updated["role"],
        name=updated["name"] or "",
        username=updated["username"] or "",
        standard=updated["standard"] or "",
        school=updated["school"] or "",
        created_at=str(updated["created_at"]),
    )
