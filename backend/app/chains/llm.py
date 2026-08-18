"""LangChain LLM wrapper using Groq."""

from langchain_groq import ChatGroq
from ..config import settings


def get_llm(temperature: float = 0.2, streaming: bool = True) -> ChatGroq:
    """Returns a ChatGroq LLM instance configured from app settings."""
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=settings.GROQ_MODEL,
        temperature=temperature,
        streaming=streaming,
    )


def get_structured_llm(temperature: float = 0.0) -> ChatGroq:
    """Returns a non-streaming ChatGroq instance for structured output (JSON mode)."""
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=settings.GROQ_MODEL,
        temperature=temperature,
        streaming=False,
    )
