import React from 'react';
import Icon from '../common/Icon';
import { clsx } from 'clsx';

export default function CitationPill({ text, subject, isClickable = false, onClick }) {
  const subjectColors = {
    Maths: 'text-subject-maths bg-subject-maths/10 border-subject-maths/30',
    Science: 'text-subject-science bg-subject-science/10 border-subject-science/30',
    Social: 'text-subject-social bg-subject-social/10 border-subject-social/30',
    default: 'text-primary bg-primary/10 border-primary/30'
  };

  const colorClass = subjectColors[subject] || subjectColors.default;

  if (isClickable && onClick) {
    return (
      <button 
        onClick={onClick}
        type="button"
        className={clsx(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-medium transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer hover:bg-opacity-20 group",
          colorClass
        )}
        title="Inspect textbook page & excerpt (Admin)"
      >
        <Icon name="menu_book" style={{ fontSize: '13px' }} className="group-hover:text-primary transition-colors" />
        <span>{text}</span>
        <Icon name="visibility" style={{ fontSize: '12px' }} className="opacity-60 group-hover:opacity-100 ml-0.5" />
      </button>
    );
  }

  // Non-clickable reference badge for students / regular users
  return (
    <div 
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-medium opacity-90 select-none cursor-default",
        colorClass
      )}
      title="Source textbook reference"
    >
      <Icon name="menu_book" style={{ fontSize: '13px' }} />
      <span>{text}</span>
    </div>
  );
}
