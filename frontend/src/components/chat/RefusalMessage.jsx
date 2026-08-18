import React from 'react';
import Icon from '../common/Icon';

export default function RefusalMessage({ message }) {
  const textContent = typeof message === 'object' ? (message.content || message.text) : message;

  return (
    <div className="flex w-full justify-start">
      <div className="flex gap-3 max-w-[85%] flex-row">
        <div className="w-8 h-8 rounded-full bg-surface-variant flex-shrink-0 flex items-center justify-center text-on-surface-variant mt-1">
          <Icon name="info" style={{ fontSize: '18px' }} />
        </div>
        <div className="p-4 text-body-md bg-surface-variant text-on-surface rounded-2xl rounded-tl-sm border border-outline-variant/30">
          <p>{textContent || "The requested information is unavailable in the provided Gujarat State Board textbooks."}</p>
        </div>
      </div>
    </div>
  );
}
