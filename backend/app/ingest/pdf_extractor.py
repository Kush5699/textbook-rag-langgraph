import pymupdf  # Modern PyMuPDF API
from PIL import Image
import io
import shutil
import logging
import gc

logger = logging.getLogger(__name__)

# Check once at module load if tesseract executable is on PATH
TESSERACT_AVAILABLE = shutil.which("tesseract") is not None
EASYOCR_READER = None


def get_easyocr_reader():
    """Lazily load EasyOCR reader with disabled gradients and single thread."""
    global EASYOCR_READER
    if EASYOCR_READER is None:
        try:
            import torch
            torch.set_num_threads(1)
            import easyocr
            EASYOCR_READER = easyocr.Reader(['en'], gpu=False, verbose=False, quantize=True)
            logger.info("EasyOCR initialized with memory quantization.")
        except Exception as e:
            logger.warning(f"EasyOCR initialization failed: {e}")
            EASYOCR_READER = False
    return EASYOCR_READER if EASYOCR_READER is not False else None


def extract_text_from_pdf(file_path: str):
    """
    Extracts text and structured tables page by page using PyMuPDF.
    1. Extracts native digital text and structured Markdown tables.
    2. Uses OCR only when necessary, with strict memory management.
    """
    doc = pymupdf.open(file_path)
    pages_data = []

    # Quick heuristic check: Is this overall a digital PDF with searchable text?
    sample_pages = [doc[i] for i in range(min(15, len(doc))) if i % 2 == 0]
    has_digital_text = sum(len(p.get_text("text").strip()) for p in sample_pages) > 300

    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # 1. Extract regular digital text
            text = page.get_text("text").strip()

            # 2. Extract structured tables as Markdown
            try:
                tabs = page.find_tables()
                if tabs.tables:
                    table_markdowns = []
                    for tab in tabs:
                        df_markdown = tab.to_markdown()
                        if df_markdown and df_markdown.strip():
                            table_markdowns.append(f"\n[Table Data]\n{df_markdown.strip()}\n")
                    
                    if table_markdowns:
                        text = text + "\n" + "\n".join(table_markdowns)
            except Exception as tab_err:
                logger.debug(f"Table extraction skipped for page {page_num + 1}: {tab_err}")

            # 3. Only run OCR if the document is actually a scanned PDF (or text is empty in a scanned doc)
            if len(text) < 40 and not has_digital_text:
                if TESSERACT_AVAILABLE:
                    try:
                        pix = page.get_pixmap(dpi=120)
                        img = Image.open(io.BytesIO(pix.tobytes()))
                        ocr_text = pytesseract.image_to_string(img, lang="eng")
                        if ocr_text.strip():
                            text = ocr_text.strip()
                        del pix, img
                    except Exception:
                        pass
                else:
                    reader = get_easyocr_reader()
                    if reader:
                        try:
                            import torch
                            with torch.no_grad():
                                pix = page.get_pixmap(dpi=100)
                                ocr_lines = reader.readtext(pix.tobytes(), detail=0)
                                if ocr_lines:
                                    text = " ".join(ocr_lines).strip()
                                del pix
                        except Exception as eocr_err:
                            logger.debug(f"EasyOCR error on page {page_num + 1}: {eocr_err}")

            # Periodic garbage collection to prevent memory spikes on small 512MB instances
            if page_num > 0 and page_num % 25 == 0:
                gc.collect()
            
            pages_data.append({
                "page_number": page_num + 1,
                "text": text
            })
    finally:
        doc.close()
        gc.collect()
        
    return pages_data
