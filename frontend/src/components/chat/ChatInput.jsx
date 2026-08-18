import React, { useState, useRef } from 'react';
import Icon from '../common/Icon';
import { sanitizePaste } from '../../utils/pasteSanitizer';

export default function ChatInput({ onSend, disabled }) {
  const [content, setContent] = useState('');
  const textareaRef = useRef(null);

  const handleInput = (e) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    const sanitized = sanitizePaste(pastedText);
    
    // Insert sanitized text at cursor position
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + sanitized + content.slice(end);
    setContent(newContent);
    
    // Auto-resize after paste
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (content.trim() && !disabled) {
      onSend(content);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="w-full">
      <div className="relative flex items-end bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-2 transition-shadow focus-within:shadow-[0_8px_24px_rgba(0,0,0,0.08)] focus-within:border-primary/30">
        <button className="p-3 text-on-surface-variant hover:text-primary transition-colors rounded-full flex-shrink-0">
          <Icon name="attach_file" />
        </button>
        
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask a question about your textbooks..."
          className="flex-1 max-h-[200px] bg-transparent border-none focus:outline-none resize-none py-3 px-2 text-base text-on-surface placeholder:text-on-surface-variant/60"
          rows={1}
          disabled={disabled}
        />
        
        <button 
          onClick={handleSubmit}
          disabled={disabled || !content.trim()}
          className="p-3 bg-primary text-on-primary rounded-full flex-shrink-0 disabled:opacity-50 disabled:bg-surface-container disabled:text-on-surface-variant transition-all ml-2 hover:scale-105 active:scale-95"
        >
          <Icon name="arrow_upward" />
        </button>
      </div>
    </div>
  );
}
