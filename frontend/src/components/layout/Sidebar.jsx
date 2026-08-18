import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Icon from '../common/Icon';
import { useChat } from '../../contexts/ChatContext';
import { clsx } from 'clsx';

export default function Sidebar({ isOpen = true, onClose }) {
  const navigate = useNavigate();
  const chatContext = useChat();
  const sessions = chatContext?.sessions || [];
  const activeSession = chatContext?.activeSession;
  const setActiveSession = chatContext?.setActiveSession;
  const newSession = chatContext?.newSession;
  const removeSession = chatContext?.removeSession;

  const handleNewChat = async () => {
    if (newSession) {
      await newSession();
    }
    navigate('/app/chat');
  };

  const handleSelectSession = (session) => {
    if (setActiveSession) {
      setActiveSession(session);
    }
    navigate('/app/chat');
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (removeSession) {
      await removeSession(sessionId);
    }
  };

  const navItems = [
    { name: 'Chat', path: '/app/chat', icon: 'chat' },
    { name: 'Library', path: '/app/library', icon: 'local_library' },
    { name: 'Settings', path: '/app/settings', icon: 'settings' },
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="w-[270px] flex flex-col bg-surface border-r border-outline-variant h-screen sticky top-0 flex-shrink-0 z-30 shadow-sm transition-all duration-200">
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base text-primary flex items-center gap-2 font-display font-bold">
            <Icon name="school" /> GSSTB Scholar
          </h1>
        </div>
        <p className="text-xs text-on-surface-variant mt-0.5">Gujarat State Board RAG</p>
      </div>
      
      <div className="px-4 mb-3">
        <button 
          onClick={handleNewChat}
          className="w-full bg-primary text-on-primary py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm font-medium text-xs"
        >
          <Icon name="add" style={{ fontSize: '18px' }} /> New Research
        </button>
      </div>

      <nav className="px-4 space-y-1 mb-3">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-xs ${
                isActive 
                  ? 'bg-surface-container-low text-primary border-r-4 border-primary font-semibold' 
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <Icon name={item.icon} style={{ fontSize: '18px' }} />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Chat History Section */}
      <div className="flex-1 overflow-y-auto px-4 border-t border-outline-variant/40 pt-3">
        <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 px-2 flex items-center justify-between">
          <span>Recent Research</span>
          <span className="text-[10px] opacity-70 font-mono">{sessions.length}</span>
        </div>
        
        {sessions.length === 0 ? (
          <p className="text-xs text-on-surface-variant/60 italic px-2">No history yet</p>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = activeSession?.id === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={clsx(
                    "group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer",
                    isActive
                      ? 'bg-primary/10 text-primary font-medium shadow-xs'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  )}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    <Icon name="chat_bubble_outline" style={{ fontSize: '14px' }} className="flex-shrink-0" />
                    <span className="truncate">{session.title || 'Research Session'}</span>
                  </div>

                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-error transition-opacity flex-shrink-0 ml-1 rounded hover:bg-surface-container-high"
                    title="Delete research chat"
                  >
                    <Icon name="delete" style={{ fontSize: '14px' }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-outline-variant mt-auto text-[11px] text-on-surface-variant text-center opacity-70">
        GSSTB Scholar v1.0
      </div>
    </aside>
  );
}
