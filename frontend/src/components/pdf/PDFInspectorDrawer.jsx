import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Icon from '../common/Icon';
import { motion, AnimatePresence } from 'framer-motion';
import { getDocumentPdfUrl } from '../../api/documents';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

/**
 * Extract highlight bounding boxes for matching text items on the PDF page
 */
function extractHighlights(textContent, viewport, snippet) {
  if (!snippet || !textContent?.items?.length) return [];

  // Normalize snippet into clean words
  const cleanSnippet = snippet.toLowerCase().replace(/[^\w\s]/g, ' ');
  const snippetWords = cleanSnippet.split(/\s+/).filter((w) => w.length >= 2);
  const snippetWordSet = new Set(snippetWords);

  const highlights = [];

  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue;

    const itemStr = item.str.toLowerCase();
    const itemClean = itemStr.replace(/[^\w\s]/g, ' ').trim();
    const itemWords = itemClean.split(/\s+/).filter((w) => w.length >= 2);

    if (itemWords.length === 0) continue;

    // Matching logic: check overlap of words or substring presence
    const matchingWords = itemWords.filter((w) => snippetWordSet.has(w));
    const matchRatio = matchingWords.length / itemWords.length;

    const isMatch =
      matchRatio >= 0.35 ||
      (itemClean.length >= 3 && cleanSnippet.includes(itemClean)) ||
      (cleanSnippet.length >= 6 && itemStr.includes(cleanSnippet.slice(0, 15)));

    if (isMatch) {
      const [scaleX, skewY, skewX, scaleY, tx, ty] = item.transform;
      const fontHeight = Math.sqrt(scaleX * scaleX + skewY * skewY) || 12;

      // Convert PDF coordinate rectangle to canvas viewport rectangle
      const rect = viewport.convertToViewportRectangle([
        tx,
        ty,
        tx + item.width,
        ty + fontHeight,
      ]);

      const x = Math.min(rect[0], rect[2]);
      const y = Math.min(rect[1], rect[3]);
      const width = Math.max(Math.abs(rect[2] - rect[0]), 6);
      const height = Math.max(Math.abs(rect[3] - rect[1]), 10);

      highlights.push({
        x: Math.max(0, x - 2),
        y: Math.max(0, y - 1),
        width: width + 4,
        height: height + 2,
        str: item.str,
      });
    }
  }

  return highlights;
}

export default function PDFInspectorDrawer({ isOpen, onClose, citation }) {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [hasTextLayer, setHasTextLayer] = useState(true);
  const [copied, setCopied] = useState(false);

  const textbookName = citation?.textbook_name || citation?.filename || 'Textbook';
  const targetPage = Number(citation?.page_number) || 1;
  const snippet = citation?.snippet || '';
  const subject = citation?.subject || (textbookName.toLowerCase().includes('math') ? 'Maths' : 'Science');

  // Color theme mapping matching the design system
  const isMaths = subject === 'Maths' || subject === 'Mathematics';
  const highlightBg = isMaths
    ? 'bg-blue-500/35 border-b-2 border-blue-700 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
    : 'bg-emerald-500/35 border-b-2 border-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.5)]';

  // Load PDF when citation changes
  useEffect(() => {
    if (!isOpen || !citation) return;

    let isMounted = true;
    setLoading(true);
    setRenderError(null);
    setCurrentPage(targetPage);
    setHighlights([]);
    setHasTextLayer(true);

    const initPdf = async () => {
      try {
        const url = await getDocumentPdfUrl(textbookName);
        if (!isMounted) return;
        setPdfUrl(url);

        const loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: false,
        });
        const loadedPdf = await loadingTask.promise;
        if (!isMounted) return;

        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF document in inspector:', err);
        if (isMounted) {
          setRenderError('Could not render with PDF.js engine. You can still view the excerpt and open the PDF directly.');
          setLoading(false);
        }
      }
    };

    initPdf();

    return () => {
      isMounted = false;
    };
  }, [isOpen, citation, textbookName, targetPage]);

  // Render active page on canvas and extract highlights
  useEffect(() => {
    if (!pdf || !canvasRef.current || loading) return;

    let renderTask = null;
    let isCancelled = false;

    const render = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;

        // If on the target citation page, extract text bounding boxes to highlight
        if (currentPage === targetPage && snippet) {
          const textContent = await page.getTextContent();
          if (!isCancelled) {
            const hasItems = Boolean(textContent?.items?.length);
            setHasTextLayer(hasItems);

            if (hasItems) {
              const boxes = extractHighlights(textContent, viewport, snippet);
              setHighlights(boxes);
            } else {
              setHighlights([]);
            }
          }
        } else {
          setHighlights([]);
        }
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdf, currentPage, scale, loading, targetPage, snippet]);

  const handleCopySnippet = () => {
    if (snippet) {
      navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenExternal = () => {
    if (pdfUrl) {
      window.open(`${pdfUrl}#page=${currentPage}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />

          {/* Slide-in Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full lg:w-[54%] md:w-[68%] bg-surface z-50 shadow-2xl flex flex-col border-l border-outline-variant"
          >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-outline-variant bg-surface-container-lowest flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Icon name="menu_book" style={{ fontSize: '18px' }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-on-surface truncate" title={textbookName}>
                    {textbookName}
                  </h2>
                  <p className="text-[11px] text-on-surface-variant flex items-center gap-2">
                    <span className="font-semibold text-primary">Page {currentPage}</span>
                    {citation?.standard && <span>• {citation.standard}</span>}
                    {citation?.subject && <span>• {citation.subject}</span>}
                    {currentPage === targetPage && (
                      <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                        highlights.length > 0
                          ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200'
                          : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                      }`}>
                        {highlights.length > 0 ? `${highlights.length} Line Highlights` : 'Page Cited'}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={handleOpenExternal}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary text-xs font-medium flex items-center gap-1 transition-colors"
                  title="Open full PDF in new tab"
                >
                  <Icon name="open_in_new" style={{ fontSize: '14px' }} />
                  <span className="hidden sm:inline">Open PDF</span>
                </button>

                <div className="w-px h-5 bg-outline-variant mx-1" />

                <button
                  onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
                  className="p-1.5 hover:bg-surface-container text-on-surface-variant rounded-lg"
                  title="Zoom Out"
                >
                  <Icon name="zoom_out" style={{ fontSize: '18px' }} />
                </button>
                <span className="text-xs font-mono w-10 text-center text-on-surface-variant">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                  className="p-1.5 hover:bg-surface-container text-on-surface-variant rounded-lg"
                  title="Zoom In"
                >
                  <Icon name="zoom_in" style={{ fontSize: '18px' }} />
                </button>

                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-surface-container text-on-surface-variant hover:text-on-surface rounded-lg ml-1"
                  title="Close Inspector"
                >
                  <Icon name="close" style={{ fontSize: '20px' }} />
                </button>
              </div>
            </div>

            {/* Citation Excerpt Highlight Box styled to system theme */}
            {snippet && (
              <div className="px-5 py-3.5 bg-surface-container border-b border-outline-variant/60 flex-shrink-0">
                <div className="flex items-center justify-between gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-wider mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon name="format_quote" style={{ fontSize: '15px' }} />
                    <span>Retrieved Textbook Excerpt (Page {targetPage})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!hasTextLayer && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium normal-case">
                        Scanned Textbook Source
                      </span>
                    )}
                    <button
                      onClick={handleCopySnippet}
                      className="text-[11px] font-medium text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 normal-case px-1.5 py-0.5 rounded hover:bg-surface-container-high"
                      title="Copy excerpt to clipboard"
                    >
                      <Icon name={copied ? "check" : "content_copy"} style={{ fontSize: '12px' }} />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-on-surface leading-relaxed font-sans bg-surface-container-lowest p-3 rounded-lg border border-outline-variant/60 shadow-xs">
                  "{snippet}"
                </div>
              </div>
            )}

            {/* PDF Canvas View Area with Highlight Overlay */}
            <div className="flex-1 overflow-auto bg-surface-container-low p-6 flex justify-center items-start">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
                  <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-xs font-medium text-on-surface-variant">Rendering page {currentPage}...</p>
                </div>
              ) : renderError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center max-w-md bg-surface rounded-xl border border-outline-variant mt-10">
                  <Icon name="picture_as_pdf" className="text-primary text-4xl mb-3 opacity-60" />
                  <p className="text-sm font-medium text-on-surface mb-2">Textbook Page Preview</p>
                  <p className="text-xs text-on-surface-variant mb-4">{renderError}</p>
                  <button
                    onClick={handleOpenExternal}
                    className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-primary-container"
                  >
                    <Icon name="open_in_new" style={{ fontSize: '14px' }} /> Open PDF directly to page {currentPage}
                  </button>
                </div>
              ) : (
                <div className="relative shadow-2xl bg-white rounded-lg overflow-hidden border border-outline-variant/40">
                  {/* Canvas rendering PDF page */}
                  <canvas ref={canvasRef} className="block" />

                  {/* Highlight Overlay Rectangles for Vector & Searchable Text */}
                  {currentPage === targetPage &&
                    highlights.map((h, idx) => (
                      <div
                        key={idx}
                        className={`absolute rounded-xs pointer-events-none transition-all ${highlightBg}`}
                        style={{
                          left: `${h.x}px`,
                          top: `${h.y}px`,
                          width: `${h.width}px`,
                          height: `${h.height}px`,
                        }}
                        title={h.str}
                      />
                    ))}

                  {/* Focus Ring Indicator for Target Page */}
                  {currentPage === targetPage && (
                    <div className="absolute inset-0 pointer-events-none border-2 border-primary/25 rounded-lg" />
                  )}
                </div>
              )}
            </div>

            {/* Bottom Page Pagination Bar */}
            <div className="h-14 border-t border-outline-variant bg-surface-container-lowest px-5 flex items-center justify-between flex-shrink-0">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-xs font-medium text-on-surface hover:bg-surface-container disabled:opacity-40 flex items-center gap-1"
              >
                <Icon name="chevron_left" style={{ fontSize: '16px' }} /> Previous
              </button>

              <div className="text-xs font-medium text-on-surface-variant">
                Page <span className="font-bold text-on-surface">{currentPage}</span> of{' '}
                <span className="font-bold text-on-surface">{totalPages || '-'}</span>
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages || p + 1, p + 1))}
                disabled={currentPage >= (totalPages || 1) || loading}
                className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-xs font-medium text-on-surface hover:bg-surface-container disabled:opacity-40 flex items-center gap-1"
              >
                Next <Icon name="chevron_right" style={{ fontSize: '16px' }} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
