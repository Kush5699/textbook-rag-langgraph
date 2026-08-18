import json
import logging
from groq import AsyncGroq
from ..config import settings

logger = logging.getLogger(__name__)


async def route_and_contextualize_query(query: str, conversation_history: list) -> tuple[str, dict]:
    """
    1. Uses LLM to rewrite follow-up queries with pronoun references into a standalone search query.
    2. Extracts standard and subject metadata filters.
    Returns (standalone_query, filters_dict).
    """
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    
    clean_history = []
    for msg in conversation_history:
        role = "assistant" if getattr(msg, 'role', '') in ("ai", "assistant") else "user"
        content = getattr(msg, 'content', str(msg))
        if content and content.strip():
            clean_history.append({"role": role, "content": content})

    sys_prompt = """You are a search query optimizer and filter router for a Gujarat State Board textbook RAG system (Std 9 to 12).
Given the chat history and the user's latest query:
1. "standalone_query": Rewrite the query into a self-contained, keyword-rich search query resolving all pronouns ("it", "them", "these", "those", "this") and conversational references to prior topics so it can be effectively used for vector and BM25 retrieval. If already standalone, keep it clean and focused.
2. "standards": Array of standards if mentioned or strongly inferred (e.g. ["Std_09"], ["Std_10"], ["Std_11"], ["Std_12"]).
3. "subjects": Array of subjects if mentioned or strongly inferred (e.g. ["Science"], ["Maths"], ["Social Science"]).

Return ONLY a valid JSON object matching this schema:
{
  "standalone_query": "string",
  "standards": ["Std_09"],
  "subjects": ["Science"]
}"""

    messages = [{"role": "system", "content": sys_prompt}]
    # Take up to last 6 messages of history for context
    messages.extend(clean_history[-6:])
    messages.append({"role": "user", "content": query})

    try:
        response = await client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0
        )
        
        raw_json = response.choices[0].message.content
        data = json.loads(raw_json)
        
        standalone_query = data.get("standalone_query") or query
        filters = {}
        if data.get("standards"):
            filters["standard"] = data["standards"]
        if data.get("subjects"):
            filters["subject"] = data["subjects"]
            
        logger.info(f"Query contextualized: '{query}' -> '{standalone_query}', filters={filters}")
        return standalone_query, filters
    except Exception as e:
        logger.warning(f"Query contextualization fallback: {e}")
        return query, {}


async def route_query(query: str, conversation_history: list) -> dict:
    _, filters = await route_and_contextualize_query(query, conversation_history)
    return filters
