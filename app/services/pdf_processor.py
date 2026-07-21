from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader

from app.services.chunking import PageText


class PdfProcessingError(RuntimeError):
    pass


def extract_pages(path: Path) -> list[PageText]:
    try:
        reader = PdfReader(str(path))
    except Exception as exc:  # pypdf has multiple reader exceptions
        raise PdfProcessingError("The uploaded file could not be read as a PDF.") from exc

    pages: list[PageText] = []
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text(extraction_mode="layout") or ""
        pages.append(PageText(page_number=index, text=text))
    return pages


def needs_ocr(pages: list[PageText]) -> bool:
    return bool(pages) and sum(len(page.text.strip()) for page in pages) / len(pages) < 40


def ocr_pages(path: Path, language: str = "eng") -> list[PageText]:
    """OCR fallback. Docker installs Poppler and English/Gujarati Tesseract packs."""
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError as exc:
        raise PdfProcessingError("OCR dependencies are not installed.") from exc
    try:
        images = convert_from_path(str(path), dpi=220)
        return [PageText(index, pytesseract.image_to_string(image, lang=language)) for index, image in enumerate(images, 1)]
    except Exception as exc:
        raise PdfProcessingError("OCR failed. Ensure Poppler and the requested Tesseract language pack are installed.") from exc

