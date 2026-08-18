import pymupdf  # Modern PyMuPDF API
from PIL import Image
import io
import shutil
import logging
import gc

logger = logging.getLogger(__name__)

# Check dynamically if tesseract executable is on PATH
def is_tesseract_available():
    return shutil.which("tesseract") is not None

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
    Extracts text and structured tables page by page using PyMuPDF and OCR.
    1. Robustly samples throughout the book to detect digital text.
    2. Extracts digital text and tables directly with zero memory overhead.
    3. Uses lightweight native C++ Tesseract OCR for scanned image textbooks.
    4. Falls back to quantized EasyOCR if Tesseract is not present.
    """
    doc = pymupdf.open(file_path)
    pages_data = []
    total_pages = len(doc)
    tesseract_available = is_tesseract_available()

    # Sample middle and later pages across the book body (avoids blank cover/copyright pages)
    sample_ratios = [0.15, 0.30, 0.45, 0.60, 0.75, 0.85]
    sample_indices = [int(total_pages * r) for r in sample_ratios] if total_pages >= 10 else list(range(total_pages))
    
    total_sample_chars = 0
    for idx in sample_indices:
        if idx < total_pages:
            try:
                total_sample_chars += len(doc[idx].get_text("text").strip())
            except Exception:
                pass
                
    has_digital_text = total_sample_chars > 150
    logger.info(f"PDF Extraction: '{file_path}' ({total_pages} pages) - Digital: {has_digital_text} (sample chars: {total_sample_chars}, Tesseract OCR: {tesseract_available})")

    try:
        for page_num in range(total_pages):
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

            # 3. Apply lightweight OCR for purely scanned books (0 digital text)
            if len(text) < 30 and not has_digital_text:
                if tesseract_available:
                    try:
                        import pytesseract
                        # 100 DPI gives clean OCR text while using only ~15MB RAM
                        pix = page.get_pixmap(dpi=100)
                        img = Image.open(io.BytesIO(pix.tobytes()))
                        ocr_text = pytesseract.image_to_string(img, lang="eng")
                        if ocr_text.strip():
                            text = ocr_text.strip()
                        del pix, img
                    except Exception as tess_err:
                        logger.debug(f"Tesseract OCR error on page {page_num + 1}: {tess_err}")
                else:
                    reader = get_easyocr_reader()
                    if reader:
                        try:
                            import torch
                            with torch.no_grad():
                                pix = page.get_pixmap(dpi=80)
                                ocr_lines = reader.readtext(pix.tobytes(), detail=0)
                                if ocr_lines:
                                    text = " ".join(ocr_lines).strip()
                                del pix
                        except Exception as eocr_err:
                            logger.debug(f"EasyOCR error on page {page_num + 1}: {eocr_err}")

            # Periodic garbage collection every 20 pages
            if page_num > 0 and page_num % 20 == 0:
                gc.collect()
            
            pages_data.append({
                "page_number": page_num + 1,
                "text": text
            })
            
            # Log progress every 50 pages for large scanned books
            if (page_num + 1) % 50 == 0 or (page_num + 1) == total_pages:
                logger.info(f"Ingestion progress for '{file_path}': {page_num + 1}/{total_pages} pages processed.")
                
    finally:
        doc.close()
        gc.collect()
        
    return pages_data
