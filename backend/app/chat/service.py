import json
import logging
from langchain_core.messages import HumanMessage, AIMessage
from ..graph.rag_graph import run_rag_agent
from ..sessions.service import add_message, get_session_history, update_session_title

logger = logging.getLogger(__name__)

REFUSAL_MESSAGE = (
    "The requested information is unavailable in the provided "
    "Gujarat State Board textbooks."
)


def _convert_to_langchain_messages(history: list) -> list:
    """Convert DB chat history (ChatMessage objects) to LangChain message format."""
    messages = []
    for msg in history:
        content = msg.content if hasattr(msg, 'content') else str(msg)
        role = msg.role if hasattr(msg, 'role') else 'user'
        if role in ('assistant', 'ai'):
            messages.append(AIMessage(content=content))
        else:
            messages.append(HumanMessage(content=content))
    return messages


def _generate_session_title(query: str) -> str:
    """Generate a clean session title from the query."""
    stop_words = {
        "what", "are", "the", "is", "can", "you", "please", "pls",
        "tell", "me", "about", "how", "to", "explain", "provide",
    }
    clean_words = [
        w for w in query.replace("?", "").replace(".", "").split()
        if w.lower() not in stop_words
    ]
    if not clean_words:
        clean_words = query.split()[:4]
    clean_title = " ".join([w.capitalize() for w in clean_words[:5]])
    if len(clean_title) > 35:
        clean_title = clean_title[:35].rstrip()
    return clean_title


async def process_chat(db, session_id: str, user_message: str, user_id: str):
    """
    Full RAG pipeline orchestration using LangGraph agent:
    1. Save user message to DB
    2. Get conversation history and convert to LangChain format
    3. Auto-update session title if default
    4. Run the LangGraph RAG agent (rewrite -> filter -> retrieve -> grade -> generate -> hallucination check)
    5. Save assistant response to DB immediately (persists even if user leaves the tab)
    6. Stream the response via SSE events
    """
    # 1. Save user message immediately
    await add_message(db, session_id, "user", user_message)

    # 2. Get conversation history
    history = await get_session_history(db, session_id, user_id, limit=10)
    # Exclude the message we just saved to avoid duplication
    history_for_agent = [m for m in history if m.role != "user" or m.content != user_message]
    lc_history = _convert_to_langchain_messages(history_for_agent)

    # 3. Auto-update session title if still default
    current_title = "New Research"
    async with db.execute("SELECT title FROM sessions WHERE id = ?", (session_id,)) as cursor:
        s_row = await cursor.fetchone()
        if s_row and s_row["title"]:
            current_title = s_row["title"]

    new_session_title = None
    if current_title in ("New Research", "Research Session") or not current_title:
        clean_title = _generate_session_title(user_message)
        if clean_title:
            await update_session_title(db, session_id, clean_title)
            new_session_title = clean_title
            current_title = clean_title

    # 4. Run the LangGraph RAG agent
    try:
        result = await run_rag_agent(
            question=user_message,
            chat_history=lc_history,
        )
    except Exception as e:
        logger.error(f"LangGraph agent error: {e}")
        result = {
            "generation": REFUSAL_MESSAGE,
            "citations": [],
            "refused": True,
        }

    generation = result.get("generation", REFUSAL_MESSAGE)
    citations = result.get("citations", [])
    refused = result.get("refused", False)

    # 5. CRITICAL: Save assistant response to SQLite immediately so that even if the user
    # switches tabs or navigates away during stream, the message is permanently saved!
    await add_message(
        db, session_id, "assistant", generation,
        citations=citations, refused=refused,
    )

    # 6. Stream the response via SSE
    async def generation_stream():
        # Stream the generation in small word-chunks for smooth SSE streaming
        chunk_size = 4  # words per chunk
        words = generation.split(" ")
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i + chunk_size])
            if i > 0:
                chunk = " " + chunk
            yield json.dumps({"event": "token", "data": {"text": chunk}})

        # Final event with citations and session title
        yield json.dumps({
            "event": "done",
            "data": {
                "citations": citations,
                "refused": refused,
                "session_title": new_session_title or current_title,
            },
        })

    return generation_stream()
