import uuid
import json
import aiosqlite
from fastapi import HTTPException
from ..models import SessionResponse, ChatMessage


async def create_session(db: aiosqlite.Connection, user_id: str, title: str) -> SessionResponse:
    session_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO sessions (id, user_id, title) VALUES (?, ?, ?)",
        (session_id, user_id, title)
    )
    await db.commit()
    async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cursor:
        row = await cursor.fetchone()
        return SessionResponse(
            id=row["id"],
            user_id=row["user_id"],
            title=row["title"],
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )


async def update_session_title(db: aiosqlite.Connection, session_id: str, title: str):
    await db.execute(
        "UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (title, session_id)
    )
    await db.commit()


async def get_user_sessions(db: aiosqlite.Connection, user_id: str):
    async with db.execute("SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC", (user_id,)) as cursor:
        rows = await cursor.fetchall()
        return [
            SessionResponse(
                id=r["id"],
                user_id=r["user_id"],
                title=r["title"],
                created_at=str(r["created_at"]),
                updated_at=str(r["updated_at"]),
            ) for r in rows
        ]


async def get_session_history(db: aiosqlite.Connection, session_id: str, user_id: str, limit: int = 50):
    # Verify ownership
    async with db.execute("SELECT user_id FROM sessions WHERE id = ?", (session_id,)) as cursor:
        row = await cursor.fetchone()
        if not row or row["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Session not found")
            
    async with db.execute(
        "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?", 
        (session_id, limit)
    ) as cursor:
        rows = await cursor.fetchall()
        
    messages = []
    for r in rows:
        citations = json.loads(r["citations_json"]) if r["citations_json"] else None
        messages.append(ChatMessage(
            id=r["id"],
            role=r["role"],
            content=r["content"],
            citations=citations,
            refused=bool(r["refused"]),
            created_at=str(r["created_at"]),
        ))
    messages.reverse()
    return messages


async def add_message(db: aiosqlite.Connection, session_id: str, role: str, content: str, citations: list = None, refused: bool = False):
    msg_id = str(uuid.uuid4())
    cit_json = json.dumps(citations) if citations else None
    await db.execute(
        "INSERT INTO messages (id, session_id, role, content, citations_json, refused) VALUES (?, ?, ?, ?, ?, ?)",
        (msg_id, session_id, role, content, cit_json, refused)
    )
    await db.execute("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
    await db.commit()


async def delete_session(db: aiosqlite.Connection, session_id: str, user_id: str):
    async with db.execute("SELECT user_id FROM sessions WHERE id = ?", (session_id,)) as cursor:
        row = await cursor.fetchone()
        if not row or row["user_id"] != user_id:
            raise HTTPException(status_code=404, detail="Session not found")

    await db.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
    await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    await db.commit()
    return {"message": "Session deleted", "id": session_id}
