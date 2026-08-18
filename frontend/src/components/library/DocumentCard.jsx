import React, { useState } from 'react';
import Icon from '../common/Icon';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { getDocumentPdfUrl, deleteDocument } from '../../api/documents';
import { useAuth } from '../../contexts/AuthContext';

export default function DocumentCard({ document, onDelete }) {
  const { isAdmin } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const subjectColors = {
    Maths: 'bg-subject-maths',
    Science: 'bg-subject-science',
    Social: 'bg-subject-social',
    default: 'bg-primary'
  };

  const title = document.textbook_name || document.filename || 'Textbook PDF';
  const subject = document.subject || 'General';
  const standard = document.standard || 'Std 9-12';
  const status = document.status || 'Uploaded';
  const borderClass = subjectColors[subject] || subjectColors.default;

  const isCompleted = status === 'Completed' || status === 'Verified';
  const isProcessing = status === 'Processing' || status === 'Uploaded';
  const isFailed = status === 'Failed';

  const formattedDate = document.created_at 
    ? new Date(document.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recently';

  const handleOpenPdf = async (e) => {
    e.stopPropagation();
    if (!isAdmin) return;
    try {
      const url = await getDocumentPdfUrl(document.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Failed to open PDF:', err);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!isAdmin) return;
    const confirmed = window.confirm(`Are you sure you want to delete "${title}"? This will remove its vectors and indexing from search.`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteDocument(document.id);
      if (onDelete) {
        onDelete(document.id);
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
      alert('Failed to delete textbook: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div 
      whileHover={isAdmin ? { y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' } : {}}
      onClick={isAdmin ? handleOpenPdf : undefined}
      className={clsx(
        "bg-surface-container-lowest rounded-xl border border-outline-variant/60 relative overflow-hidden flex flex-col h-52 transition-all",
        isAdmin ? "cursor-pointer group" : "cursor-default",
        isDeleting && "opacity-50 pointer-events-none"
      )}
    >
      <div className={clsx("absolute left-0 top-0 bottom-0 w-1.5", borderClass)} />
      
      <div className="p-5 flex-1 flex flex-col pl-6">
        <div className="flex justify-between items-start mb-3 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={clsx(
              "text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider",
              subject === 'Maths' ? 'text-subject-maths bg-subject-maths/10' :
              subject === 'Science' ? 'text-subject-science bg-subject-science/10' :
              subject === 'Social' ? 'text-subject-social bg-subject-social/10' :
              'text-primary bg-primary/10'
            )}>
              {subject}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
              {standard}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className={clsx(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1 uppercase",
              isCompleted && "bg-emerald-100 text-emerald-800",
              isProcessing && "bg-amber-100 text-amber-800 animate-pulse",
              isFailed && "bg-rose-100 text-rose-800"
            )}>
              <Icon 
                name={isCompleted ? "check_circle" : isProcessing ? "sync" : "error"} 
                style={{ fontSize: '12px' }} 
                className={isProcessing ? "animate-spin" : ""}
              /> 
              {status}
            </div>

            {isAdmin && (
              <button
                onClick={handleDelete}
                className="p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors"
                title="Delete textbook from library"
              >
                <Icon name="delete" style={{ fontSize: '16px' }} />
              </button>
            )}
          </div>
        </div>
        
        <h3 className="text-headline-sm font-display font-semibold text-on-surface line-clamp-1 mb-1" title={title}>
          {title}
        </h3>
        
        <div className="text-body-sm text-on-surface-variant line-clamp-2 mt-1 space-y-0.5">
          <p className="truncate text-xs font-mono opacity-70">{document.filename}</p>
          {document.page_count ? (
            <p className="text-xs font-medium text-on-surface/80">
              {document.page_count} Pages • {document.chunk_count || 0} Vector Chunks
            </p>
          ) : (
            <p className="text-xs text-on-surface-variant/70 italic">Processing document chunks...</p>
          )}
        </div>
        
        <div className="mt-auto pt-3 border-t border-outline-variant/30 flex items-center justify-between text-on-surface-variant text-[11px]">
          <span className="flex items-center gap-1.5">
            <Icon name="picture_as_pdf" style={{ fontSize: '15px' }} className="text-primary/70" />
            Added {formattedDate}
          </span>
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleOpenPdf}
                className="text-primary font-medium group-hover:underline flex items-center gap-0.5 hover:text-primary-container"
              >
                View PDF <Icon name="open_in_new" style={{ fontSize: '12px' }} />
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-on-surface-variant/60 font-medium italic">
              Indexed in RAG
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
