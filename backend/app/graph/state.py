"""State definition for the LangGraph RAG agent."""

from typing import TypedDict, List, Optional
from langchain_core.documents import Document
from langchain_core.messages import BaseMessage


class GraphState(TypedDict):
    """State that flows through the LangGraph RAG agent nodes."""

    # Input
    question: str
    chat_history: List[BaseMessage]

    # Query processing
    rewritten_query: str
    filters: dict

    # Retrieval
    documents: List[Document]

    # Generation
    generation: str
    citations: list

    # Control flow
    is_relevant: bool
    is_grounded: bool
    refused: bool
    retry_count: int
