import fitz  # PyMuPDF
from PIL import Image
import io
import shutil
import logging

logger = logging.getLogger(__name__)

# Check once at module load if tesseract executable is on PATH
TESSERACT_AVAILABLE = shutil.which("tesseract") is not None
EASYOCR_READER = None

def get_easyocr_reader():
    """Lazily load EasyOCR reader once only when needed for scanned pages"""
    global EASYOCR_READER
    if EASYOCR_READER is None:
        try:
            import easyocr
            EASYOCR_READER = easyocr.Reader(['en'], gpu=False, verbose=False)
            logger.info("EasyOCR initialized successfully for scanned PDF extraction.")
        except Exception as e:
            logger.warning(f"EasyOCR initialization failed: {e}")
            EASYOCR_READER = False
    return EASYOCR_READER if EASYOCR_READER is not False else None


def extract_text_from_pdf(file_path: str):
    """
    Extracts text and structured tables page by page using PyMuPDF.
    1. Extracts native digital text and structured Markdown tables.
    2. If a page is scanned / image-based (< 50 chars), runs OCR (Tesseract or EasyOCR).
    """
    doc = fitz.open(file_path)
    pages_data = []

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

            # 3. If page is scanned / image-based, apply OCR
            if len(text) < 50:
                if TESSERACT_AVAILABLE:
                    try:
                        import pytesseract
                        pix = page.get_pixmap(dpi=150)
                        img = Image.open(io.BytesIO(pix.tobytes()))
                        ocr_text = pytesseract.image_to_string(img, lang="eng")
                        if ocr_text.strip():
                            text = ocr_text.strip()
                    except Exception:
                        pass
                else:
                    reader = get_easyocr_reader()
                    if reader:
                        try:
                            pix = page.get_pixmap(dpi=130)
                            ocr_lines = reader.readtext(pix.tobytes(), detail=0)
                            if ocr_lines:
                                text = " ".join(ocr_lines).strip()
                        except Exception as eocr_err:
                            logger.debug(f"EasyOCR error on page {page_num + 1}: {eocr_err}")
            
            pages_data.append({
                "page_number": page_num + 1,
                "text": text
            })
    finally:
        doc.close()
        
    return pages_data
