"""Generic, citation-safe parent-child chunking for unknown PDFs.

The chunker deliberately does not rely on a fixed catalogue of document types.
It prefers natural paragraph and sentence boundaries, treats heading detection as
an optional context improvement, and always preserves original PDF page ranges.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.config import Settings


@dataclass(frozen=True)
class PageText:
    page_number: int
    text: str


@dataclass(frozen=True)
class ChunkDraft:
    text: str
    page_start: int
    page_end: int
    heading: str | None
    kind: str
    ordinal: int
    parent_ordinal: int | None = None


def token_count(text: str) -> int:
    """Portable token approximation; exact provider tokenizers are not required for boundaries."""
    return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


def normalize_text(text: str) -> str:
    text = text.replace("\u00ad", "")
    text = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "", text)  # repair line-break hyphenation
    # Most textbook PDFs repeat a title plus page number in a header/footer.
    # Remove only clear folios, leaving ordinary prose and equations untouched.
    lines = []
    for line in text.splitlines():
        compact = " ".join(line.split())
        if re.fullmatch(r"(?:\d+\s*/\s*[A-Za-z][A-Za-z .'-]{1,80}|[A-Za-z][A-Za-z .'-]{1,80}\s*/\s*\d+)", compact):
            continue
        lines.append(line)
    text = "\n".join(lines)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def paragraphs_from_pages(pages: list[PageText]) -> list[tuple[int, str]]:
    blocks: list[tuple[int, str]] = []
    for page in pages:
        clean = normalize_text(page.text)
        for paragraph in re.split(r"\n\s*\n", clean):
            paragraph = paragraph.strip()
            if paragraph:
                blocks.append((page.page_number, paragraph))
    return blocks


def looks_like_heading(text: str) -> bool:
    line = " ".join(text.split())
    if not line or len(line) > 140 or len(line.split()) > 18:
        return False
    if re.match(r"^(chapter|unit|lesson|part|section)\b", line, flags=re.IGNORECASE):
        return True
    if re.match(r"^\d+(?:\.\d+)*[.)]?\s+[A-Z]", line):
        return True
    letters = [character for character in line if character.isalpha()]
    return bool(letters) and sum(character.isupper() for character in letters) / len(letters) > 0.78


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[\"'“”A-Z0-9])", text)
    return [part.strip() for part in parts if part.strip()]


def split_oversized_block(page_number: int, text: str, limit: int) -> list[tuple[int, str]]:
    if token_count(text) <= limit:
        return [(page_number, text)]
    pieces: list[tuple[int, str]] = []
    current: list[str] = []
    size = 0
    for sentence in split_sentences(text):
        sentence_size = token_count(sentence)
        if current and size + sentence_size > limit:
            pieces.append((page_number, " ".join(current)))
            current, size = [], 0
        current.append(sentence)
        size += sentence_size
    if current:
        pieces.append((page_number, " ".join(current)))
    return pieces


def _tail_overlap(text: str, overlap_tokens: int) -> str:
    if overlap_tokens == 0:
        return ""
    words = text.split()
    return " ".join(words[-overlap_tokens:])


def build_parent_child_chunks(pages: list[PageText], settings: Settings) -> tuple[list[ChunkDraft], list[ChunkDraft]]:
    """Create child chunks for precise search and parent chunks for answer context."""
    raw_blocks = paragraphs_from_pages(pages)
    blocks: list[tuple[int, str]] = []
    for page, block in raw_blocks:
        blocks.extend(split_oversized_block(page, block, settings.child_chunk_tokens))

    parents: list[ChunkDraft] = []
    children: list[ChunkDraft] = []
    parent_blocks: list[tuple[int, str]] = []
    parent_size = 0
    current_heading: str | None = None
    parent_ordinal = 0
    child_ordinal = 0

    def flush_parent() -> None:
        nonlocal parent_blocks, parent_size, parent_ordinal, child_ordinal
        if not parent_blocks:
            return
        parent_ordinal += 1
        parent_text = "\n\n".join(block for _, block in parent_blocks)
        parents.append(ChunkDraft(
            text=parent_text,
            page_start=parent_blocks[0][0],
            page_end=parent_blocks[-1][0],
            heading=current_heading,
            kind="parent",
            ordinal=parent_ordinal,
        ))
        child_blocks: list[tuple[int, str]] = []
        child_size = 0

        def flush_child() -> None:
            nonlocal child_blocks, child_size, child_ordinal
            if not child_blocks:
                return
            child_ordinal += 1
            children.append(ChunkDraft(
                text="\n\n".join(value for _, value in child_blocks),
                page_start=child_blocks[0][0],
                page_end=child_blocks[-1][0],
                heading=current_heading,
                kind="child",
                ordinal=child_ordinal,
                parent_ordinal=parent_ordinal,
            ))
            overlap = _tail_overlap(child_blocks[-1][1], settings.chunk_overlap_tokens)
            child_blocks = [(child_blocks[-1][0], overlap)] if overlap else []
            child_size = token_count(overlap)

        for page, block in parent_blocks:
            size = token_count(block)
            if child_blocks and child_size + size > settings.child_chunk_tokens:
                flush_child()
            child_blocks.append((page, block))
            child_size += size
        flush_child()
        parent_blocks, parent_size = [], 0

    for page, block in blocks:
        if looks_like_heading(block):
            if parent_blocks:
                flush_parent()
            current_heading = block
            continue
        size = token_count(block)
        if parent_blocks and parent_size + size > settings.parent_chunk_tokens:
            flush_parent()
        parent_blocks.append((page, block))
        parent_size += size

    flush_parent()
    return parents, children


def contextualize(text: str, *, source_name: str, page_start: int, page_end: int, heading: str | None, subject: str | None, standard: str | None) -> str:
    page_label = str(page_start) if page_start == page_end else f"{page_start}-{page_end}"
    context = [f"Source textbook: {source_name}", f"PDF pages: {page_label}"]
    if standard:
        context.append(f"Standard: {standard}")
    if subject:
        context.append(f"Subject: {subject}")
    if heading:
        context.append(f"Section: {heading}")
    return "\n".join(context) + "\n\n" + text
