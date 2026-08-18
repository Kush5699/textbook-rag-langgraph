import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { streamChat } from '../../api/chat';
import { getSessionHistory } from '../../api/sessions';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import RetrievalIndicator from './RetrievalIndicator';
import RefusalMessage from './RefusalMessage';
import PDFInspectorDrawer from '../pdf/PDFInspectorDrawer';
import AmbientGradient from '../landing/AmbientGradient';
import Icon from '../common/Icon';

export default function ChatView() {
  const { activeSession, ensureSession, removeSession, updateSessionTitle } = useChat();
  const { isAdmin } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingCitations, setStreamingCitations] = useState([]);
  const [selectedCitation, setSelectedCitation] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load history when active session changes
  useEffect(() => {
    if (activeSession?.id) {
      getSessionHistory(activeSession.id)
        .then((data) => setMessages(data || []))
        .catch((err) => {
          console.error('Failed to load session history:', err);
          setMessages([]);
        });
    } else {
      setMessages([]);
    }
  }, [activeSession?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleDeleteCurrentSession = async () => {
    if (activeSession?.id && removeSession) {
      await removeSession(activeSession.id);
    }
  };

  const handleCitationClick = (citation) => {
    if (isAdmin) {
      setSelectedCitation(citation);
    }
  };

  const handleSend = async (content) => {
    if (!content.trim()) return;

    let session = activeSession;
    if (!session && ensureSession) {
      session = await ensureSession();
    }

    if (!session?.id) {
      console.error('No active session available');
      return;
    }

    const userMsg = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingContent('');
    setStreamingCitations([]);

    let currentStream = '';

    try {
      await streamChat(
        session.id,
        content,
        // onToken
        (text) => {
          currentStream += text;
          setStreamingContent(currentStream);
        },
        // onDone
        ({ citations, refused, sessionTitle }) => {
          if (sessionTitle && updateSessionTitle) {
            updateSessionTitle(session.id, sessionTitle);
          }
          const assistantMsg = {
            role: 'assistant',
            content: currentStream,
            citations: citations || [],
            refused: refused || false,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setStreamingContent('');
          setStreamingCitations([]);
          setIsLoading(false);
        },
        // onError
        (error) => {
          console.error('Chat stream error:', error);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: 'An error occurred while generating a response. Please try again.',
              citations: [],
              refused: false,
            },
          ]);
          setStreamingContent('');
          setIsLoading(false);
        }
      );
    } catch (e) {
      console.error('Chat error:', e);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Session header sub-bar */}
      {activeSession?.id && (
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-outline-variant/30 bg-surface-container-lowest/60 text-xs text-on-surface-variant z-10">
          <span className="font-medium text-on-surface flex items-center gap-2">
            <Icon name="chat_bubble_outline" style={{ fontSize: '15px' }} className="text-primary" />
            {activeSession.title || 'Current Research Session'}
          </span>
          <button
            onClick={handleDeleteCurrentSession}
            className="flex items-center gap-1.5 hover:text-error text-on-surface-variant/80 transition-colors px-2.5 py-1 rounded hover:bg-surface-container font-medium"
            title="Delete this chat session"
          >
            <Icon name="delete" style={{ fontSize: '14px' }} />
            <span>Delete Chat</span>
          </button>
        </div>
      )}

      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex items-center justify-center text-center relative">
            <AmbientGradient />
            <div className="relative z-10">
              <div className="text-4xl font-display font-bold text-primary mb-4">
                GSSTB Scholar
              </div>
              <p className="text-lg text-on-surface-variant max-w-md mx-auto">
                Ask a question about your Gujarat State Board textbooks to start a research session.
              </p>
              <div className="flex gap-3 mt-6 justify-center">
                <span className="px-3 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed text-sm font-medium">
                  Std 9-12
                </span>
                <span className="px-3 py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-sm font-medium">
                  Multiple Subjects
                </span>
                <span className="px-3 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-sm font-medium">
                  Page Citations
                </span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          msg.refused ? (
            <RefusalMessage key={i} message={msg} />
          ) : (
            <ChatMessage
              key={i}
              message={msg}
              isAdmin={isAdmin}
              onCitationClick={handleCitationClick}
            />
          )
        ))}

        {isLoading && streamingContent === '' && <RetrievalIndicator />}

        {streamingContent && (
          <ChatMessage
            message={{ role: 'assistant', content: streamingContent }}
            isStreaming={true}
            isAdmin={isAdmin}
            onCitationClick={handleCitationClick}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating input bar */}
      <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-surface via-surface to-transparent pt-12">
        <ChatInput onSend={handleSend} disabled={isLoading} />
        <div className="text-center mt-2 text-xs text-on-surface-variant">
          GSSTB Scholar uses AI. Verify critical information with your textbook. {isAdmin ? "Click citations to inspect textbook pages." : "Citations display source textbook and page."}
        </div>
      </div>

      {/* Slide-in PDF Inspector Drawer (Admin only) */}
      {isAdmin && (
        <PDFInspectorDrawer
          isOpen={Boolean(selectedCitation)}
          citation={selectedCitation}
          onClose={() => setSelectedCitation(null)}
        />
      )}
    </div>
  );
}
