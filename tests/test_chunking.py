from app.config import Settings
from app.services.chunking import PageText, build_parent_child_chunks, contextualize


def test_generic_chunker_preserves_page_ranges_and_heading_context():
    settings = Settings(child_chunk_tokens=80, parent_chunk_tokens=250, chunk_overlap_tokens=5)
    pages = [
        PageText(1, "CHAPTER ONE\n\nPlants use sunlight to prepare food. Chlorophyll absorbs light energy.\n\nThis process releases oxygen."),
        PageText(2, "Water and carbon dioxide are also required. The process is called photosynthesis."),
    ]
    parents, children = build_parent_child_chunks(pages, settings)
    assert parents
    assert children
    assert {child.page_start for child in children} <= {1, 2}
    assert all(child.parent_ordinal is not None for child in children)
    assert parents[0].heading == "CHAPTER ONE"


def test_contextual_text_contains_reliable_citation_fields():
    text = contextualize(
        "Plants use sunlight.", source_name="Science.pdf", page_start=5, page_end=6,
        heading="Energy", subject="Science", standard="9",
    )
    assert "Source textbook: Science.pdf" in text
    assert "PDF pages: 5-6" in text
    assert text.endswith("Plants use sunlight.")
