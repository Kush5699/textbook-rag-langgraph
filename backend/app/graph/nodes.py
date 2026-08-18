"""Node functions for the LangGraph RAG agent."""

import json
import logging
from langchain_core.output_parsers import StrOutputParser
from ..chains.llm import get_llm, get_structured_llm
from ..chains.retriever import HybridRetriever
from ..chains.prompts import (
    rag_prompt,
    contextualize_prompt,
    router_prompt,
    batch_grader_prompt,
    hallucination_prompt,
)
from ..config import settings

logger = logging.getLogger(__name__)

REFUSAL_MESSAGE = (
    "The requested information is unavailable in the provided "
    "Gujarat State Board textbooks."
)


def rewrite_query(state: dict) -> dict:
    """Rewrite follow-up queries into standalone search queries using conversation history."""
    question = state["question"]
    chat_history = state.get("chat_history", [])

    if not chat_history:
        logger.info(f"No chat history, using original query: '{question[:80]}'")
        return {"rewritten_query": question}

    llm = get_structured_llm(temperature=0.0)
    chain = contextualize_prompt | llm | StrOutputParser()

    rewritten = chain.invoke({
        "chat_history": chat_history,
        "question": question,
    })

    logger.info(f"Query rewritten: '{question[:60]}' -> '{rewritten[:60]}'")
    return {"rewritten_query": rewritten.strip()}


def extract_filters(state: dict) -> dict:
    """Extract metadata filters (standard, subject) from the rewritten query."""
    query = state.get("rewritten_query", state["question"])
    llm = get_structured_llm(temperature=0.0)

    try:
        chain = router_prompt | llm | StrOutputParser()
        raw_json = chain.invoke({"query": query})
        data = json.loads(raw_json)

        filters = {}
        if data.get("standards"):
            filters["standard"] = data["standards"]
        if data.get("subjects"):
            filters["subject"] = data["subjects"]

        logger.info(f"Extracted filters: {filters}")
        return {"filters": filters}
    except Exception as e:
        logger.warning(f"Filter extraction failed: {e}")
        return {"filters": {}}


def retrieve(state: dict) -> dict:
    """Retrieve relevant documents using hybrid search (vector + BM25 + RRF)."""
    query = state.get("rewritten_query", state["question"])
    filters = state.get("filters", {})

    retriever = HybridRetriever(
        filters=filters,
        top_k=5,
        enable_rerank=settings.ENABLE_RERANKER,
    )

    documents = retriever.invoke(query)
    logger.info(f"Retrieved {len(documents)} documents")

    if not documents:
        return {
            "documents": [],
            "is_relevant": False,
            "refused": True,
            "generation": REFUSAL_MESSAGE,
            "citations": [],
        }

    return {"documents": documents}


def grade_documents(state: dict) -> dict:
    """Grade all retrieved documents in a single fast batch LLM call (< 200ms)."""
    question = state.get("rewritten_query", state["question"])
    documents = state.get("documents", [])

    if not documents:
        return {
            "is_relevant": False,
            "refused": True,
            "generation": REFUSAL_MESSAGE,
            "citations": [],
        }

    # Format documents into a single numbered block
    docs_block = "\n\n".join([
        f"[Doc {i + 1}]\n{doc.page_content[:400]}"
        for i, doc in enumerate(documents)
    ])

    llm = get_structured_llm(temperature=0.0)
    chain = batch_grader_prompt | llm | StrOutputParser()

    try:
        raw_resp = chain.invoke({
            "question": question,
            "documents": docs_block,
        })
        # Clean JSON brackets if wrapped in markdown
        cleaned = raw_resp.strip()
        if "```" in cleaned:
            cleaned = cleaned.split("```")[1].replace("json", "").strip()
        
        relevant_indices = json.loads(cleaned)
        if isinstance(relevant_indices, list):
            relevant_docs = [
                documents[idx - 1] for idx in relevant_indices
                if isinstance(idx, int) and 1 <= idx <= len(documents)
            ]
        else:
            relevant_docs = documents
    except Exception as e:
        logger.warning(f"Batch grading fallback to full set: {e}")
        relevant_docs = documents  # Keep all on parse error to be safe

    logger.info(f"Document grading: {len(relevant_docs)}/{len(documents)} relevant")

    if not relevant_docs:
        return {
            "documents": [],
            "is_relevant": False,
            "refused": True,
            "generation": REFUSAL_MESSAGE,
            "citations": [],
        }

    return {"documents": relevant_docs, "is_relevant": True}


def generate(state: dict) -> dict:
    """Generate a grounded answer using LLM with retrieved context."""
    question = state["question"]
    documents = state.get("documents", [])
    chat_history = state.get("chat_history", [])

    if not documents:
        return {"generation": REFUSAL_MESSAGE, "refused": True, "citations": []}

    # Build context string from documents
    context_parts = []
    for doc in documents:
        header = f"[{doc.metadata.get('textbook_name', 'Unknown')}, Page {doc.metadata.get('page_number', '?')}]"
        context_parts.append(f"{header}\n{doc.page_content}")
    context_str = "\n\n".join(context_parts)

    # Generate using LangChain LCEL chain
    llm = get_llm(temperature=0.2, streaming=False)
    chain = rag_prompt | llm | StrOutputParser()

    generation = chain.invoke({
        "context": context_str,
        "chat_history": chat_history,
        "question": question,
    })

    # Extract citations from documents
    citations = []
    seen_pages = set()
    for doc in documents:
        meta = doc.metadata
        page_key = f"{meta.get('textbook_name', '')}_{meta.get('page_number', '')}"
        if page_key not in seen_pages:
            seen_pages.add(page_key)
            citations.append({
                "textbook_name": meta.get("textbook_name", ""),
                "standard": meta.get("standard", ""),
                "subject": meta.get("subject", ""),
                "page_number": meta.get("page_number", 0),
                "snippet": doc.page_content[:300],
            })

    logger.info(f"Generated response ({len(generation)} chars) with {len(citations)} citations")
    return {"generation": generation, "citations": citations, "refused": False}


def check_hallucination(state: dict) -> dict:
    """Check if the generated answer is grounded in the retrieved documents."""
    generation = state.get("generation", "")
    documents = state.get("documents", [])
    retry_count = state.get("retry_count", 0)

    if not generation or not documents:
        return {"is_grounded": True}

    # Build source documents string
    docs_text = "\n\n".join([doc.page_content[:350] for doc in documents])

    llm = get_structured_llm(temperature=0.0)
    chain = hallucination_prompt | llm | StrOutputParser()

    try:
        result = chain.invoke({
            "documents": docs_text,
            "generation": generation,
        })

        is_grounded = "grounded" in result.lower() and "not_grounded" not in result.lower()
        logger.info(f"Hallucination check: {'grounded' if is_grounded else 'NOT grounded'} (retry={retry_count})")

        if not is_grounded and retry_count < 1:
            return {"is_grounded": False, "retry_count": retry_count + 1}

        return {"is_grounded": True}
    except Exception as e:
        logger.warning(f"Hallucination check failed: {e}")
        return {"is_grounded": True}
