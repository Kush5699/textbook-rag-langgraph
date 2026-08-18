import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import * as sessionsApi from '../api/sessions';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);

  const userId = user?.id || user?.firebaseUid;

  const loadSessions = useCallback(async () => {
    if (!userId) return [];
    setLoading(true);
    try {
      const data = await sessionsApi.getSessions();
      const sessionList = data || [];
      setSessions(sessionList);
      if (sessionList.length > 0) {
        setActiveSession((prev) => {
          if (prev && sessionList.some(s => s.id === prev.id)) {
            const found = sessionList.find(s => s.id === prev.id);
            return found || prev;
          }
          return sessionList[0];
        });
      }
      return sessionList;
    } catch (e) {
      console.error('Failed to load sessions:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updateSessionTitle = useCallback((sessionId, newTitle) => {
    if (!sessionId || !newTitle) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
    );
    setActiveSession((prev) =>
      prev && prev.id === sessionId ? { ...prev, title: newTitle } : prev
    );
  }, []);

  const newSession = useCallback(async () => {
    if (!userId) return null;
    try {
      const data = await sessionsApi.createSession('New Research');
      setSessions((prev) => [data, ...prev]);
      setActiveSession(data);
      return data;
    } catch (e) {
      console.error('Failed to create session:', e);
      return null;
    }
  }, [userId]);

  const removeSession = useCallback(async (sessionId) => {
    if (!userId || !sessionId) return;
    try {
      await sessionsApi.deleteSession(sessionId);
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);
        if (activeSession?.id === sessionId) {
          if (remaining.length > 0) {
            setActiveSession(remaining[0]);
          } else {
            setActiveSession(null);
            newSession();
          }
        }
        return remaining;
      });
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  }, [userId, activeSession?.id, newSession]);

  // Guarantee an active session exists
  const ensureSession = useCallback(async () => {
    if (activeSession) return activeSession;
    const list = await loadSessions();
    if (list.length > 0) {
      setActiveSession(list[0]);
      return list[0];
    }
    const created = await newSession();
    return created;
  }, [activeSession, loadSessions, newSession]);

  // Load sessions when user changes/logs in
  useEffect(() => {
    if (userId) {
      const init = async () => {
        const list = await loadSessions();
        if (!list || list.length === 0) {
          await newSession();
        }
      };
      init();
    } else {
      setSessions([]);
      setActiveSession(null);
    }
  }, [userId, loadSessions, newSession]);

  return (
    <ChatContext.Provider
      value={{
        sessions,
        activeSession,
        setActiveSession,
        loadSessions,
        newSession,
        removeSession,
        ensureSession,
        updateSessionTitle,
        loading,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
