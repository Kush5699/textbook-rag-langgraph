from fastapi import APIRouter, Depends, Request
import aiosqlite
from pydantic import BaseModel
from ..database import get_db
from ..auth.service import get_current_user
from .service import create_session, get_user_sessions, get_session_history, delete_session

router = APIRouter()

class SessionCreate(BaseModel):
    title: str = "New Chat"

@router.post("", response_model=None)
@router.post("/", response_model=None)
async def create_new_session(req: SessionCreate, request: Request, db: aiosqlite.Connection = Depends(get_db)):
    user = await get_current_user(request, db)
    return await create_session(db, user["id"], req.title)

@router.get("")
@router.get("/")
async def list_sessions(request: Request, db: aiosqlite.Connection = Depends(get_db)):
    user = await get_current_user(request, db)
    return await get_user_sessions(db, user["id"])

@router.get("/{session_id}/history")
async def session_history(session_id: str, request: Request, db: aiosqlite.Connection = Depends(get_db)):
    user = await get_current_user(request, db)
    return await get_session_history(db, session_id, user["id"], limit=50)

@router.delete("/{session_id}")
async def remove_session(session_id: str, request: Request, db: aiosqlite.Connection = Depends(get_db)):
    user = await get_current_user(request, db)
    return await delete_session(db, session_id, user["id"])
