from fastapi import APIRouter, Depends, Request
import aiosqlite
from sse_starlette.sse import EventSourceResponse
from ..database import get_db
from ..auth.service import get_current_user
from ..models import MessageCreate
from .service import process_chat

router = APIRouter()


@router.post("/stream")
@router.post("/stream/")
async def chat_endpoint(
    req: MessageCreate,
    request: Request,
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Chat endpoint that streams the RAG response via SSE.
    Accepts: {session_id: str, content: str}
    Returns: SSE stream of token events followed by a done event with citations.
    """
    user = await get_current_user(request, db)
    generator = await process_chat(db, req.session_id, req.content, user["id"])
    return EventSourceResponse(generator)
