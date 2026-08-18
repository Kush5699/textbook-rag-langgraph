"""LangChain LLM wrapper using Groq."""

from langchain_groq import ChatGroq
from ..config import settings


def get_llm(temperature: float = 0.2, streaming: bool = True) -> ChatGroq:
    """Returns a ChatGroq LLM instance configured with the flagship generation model."""
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=settings.GROQ_MODEL,
        temperature=temperature,
        streaming=streaming,
    )


def get_structured_llm(temperature: float = 0.0) -> ChatGroq:
    """Returns a fast, high-throughput ChatGroq instance for routing, batch grading, and hallucination checks."""
    fast_model = getattr(settings, "GROQ_FAST_MODEL", settings.GROQ_MODEL)
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=fast_model,
        temperature=temperature,
        streaming=False,
    )
