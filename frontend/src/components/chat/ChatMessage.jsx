import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { clsx } from 'clsx';
import Icon from '../common/Icon';
import StreamingCursor from './StreamingCursor';
import CitationPill from './CitationPill';

export default function ChatMessage({ message, isStreaming, isAdmin = false, onCitationClick }) {
  const isUser = message.role === 'user';
  const citations = message.citations || [];

  return (
    <div className={clsx('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div className={clsx('flex gap-3 max-w-[85%]', isUser ? 'flex-row-reverse' : 'flex-row')}>
        
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-on-primary mt-1 shadow-sm">
            <Icon name="smart_toy" style={{ fontSize: '18px' }} />
          </div>
        )}

        <div className="space-y-2">
          <div className={clsx(
            'p-4 text-base',
            isUser 
              ? 'bg-surface-container-low text-on-surface rounded-2xl rounded-tr-sm border border-outline-variant/30'
              : 'bg-surface-container-lowest text-on-surface rounded-2xl rounded-tl-sm border border-outline-variant shadow-sm'
          )}>
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath]} 
                  rehypePlugins={[rehypeKatex]}
                >
                  {message.content}
                </ReactMarkdown>
                {isStreaming && <StreamingCursor />}
              </div>
            )}
          </div>

          {/* Citation pills - only show for assistant messages with citations */}
          {!isUser && citations.length > 0 && !isStreaming && (
            <div className="flex flex-wrap gap-2 pl-1 pt-0.5">
              {citations.map((cit, idx) => (
                <CitationPill
                  key={idx}
                  text={`${cit.textbook_name || 'Textbook'}, p.${cit.page_number || '?'}`}
                  subject={cit.subject}
                  isClickable={isAdmin}
                  onClick={isAdmin ? () => onCitationClick && onCitationClick(cit) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
