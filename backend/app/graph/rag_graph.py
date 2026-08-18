"""LangGraph RAG agent - compiles the stateful graph and provides a runner."""

import logging
from langgraph.graph import StateGraph, END
from .state import GraphState
from .nodes import (
    rewrite_query,
    extract_filters,
    retrieve,
    grade_documents,
    generate,
    check_hallucination,
)

logger = logging.getLogger(__name__)


def _should_continue_after_retrieval(state: dict) -> str:
    """Route after retrieval: if no documents found, go to END (refusal already set)."""
    if state.get("refused", False):
        return "end"
    return "grade_documents"


def _should_continue_after_grading(state: dict) -> str:
    """Route after grading: if no relevant docs, go to END (refusal already set)."""
    if not state.get("is_relevant", False):
        return "end"
    return "generate"


def _should_continue_after_hallucination(state: dict) -> str:
    """Route after hallucination check: if not grounded and retries left, re-generate."""
    if not state.get("is_grounded", True) and state.get("retry_count", 0) <= 1:
        return "generate"
    return "end"


def build_rag_graph() -> StateGraph:
    """Build and compile the LangGraph RAG agent."""
    workflow = StateGraph(GraphState)

    # Add nodes
    workflow.add_node("rewrite_query", rewrite_query)
    workflow.add_node("extract_filters", extract_filters)
    workflow.add_node("retrieve", retrieve)
    workflow.add_node("grade_documents", grade_documents)
    workflow.add_node("generate", generate)
    workflow.add_node("check_hallucination", check_hallucination)

    # Define edges
    workflow.set_entry_point("rewrite_query")
    workflow.add_edge("rewrite_query", "extract_filters")
    workflow.add_edge("extract_filters", "retrieve")

    # Conditional: after retrieval, check if we got documents
    workflow.add_conditional_edges(
        "retrieve",
        _should_continue_after_retrieval,
        {
            "grade_documents": "grade_documents",
            "end": END,
        },
    )

    # Conditional: after grading, check if docs are relevant
    workflow.add_conditional_edges(
        "grade_documents",
        _should_continue_after_grading,
        {
            "generate": "generate",
            "end": END,
        },
    )

    workflow.add_edge("generate", "check_hallucination")

    # Conditional: after hallucination check, either accept or re-generate
    workflow.add_conditional_edges(
        "check_hallucination",
        _should_continue_after_hallucination,
        {
            "generate": "generate",
            "end": END,
        },
    )

    # Compile
    graph = workflow.compile()
    logger.info("LangGraph RAG agent compiled successfully")
    return graph


# Compile the graph once at module level
rag_agent = build_rag_graph()


async def run_rag_agent(question: str, chat_history: list) -> dict:
    """Run the RAG agent and return the final state.

    Args:
        question: The user's question.
        chat_history: List of LangChain BaseMessage objects.

    Returns:
        dict with keys: generation, citations, refused
    """
    initial_state = {
        "question": question,
        "chat_history": chat_history,
        "rewritten_query": "",
        "filters": {},
        "documents": [],
        "generation": "",
        "citations": [],
        "is_relevant": False,
        "is_grounded": False,
        "refused": False,
        "retry_count": 0,
    }

    # Run the graph asynchronously
    final_state = await rag_agent.ainvoke(initial_state)

    return {
        "generation": final_state.get("generation", ""),
        "citations": final_state.get("citations", []),
        "refused": final_state.get("refused", False),
    }
