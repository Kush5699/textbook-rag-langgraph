import { useState, useCallback } from 'react';
import * as sessionsApi from '../api/sessions';

export default function useSession() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await sessionsApi.getSessions();
      setSessions(data);
      if (data.length > 0 && !activeSession) {
        setActiveSession(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [activeSession]);

  const createSession = async () => {
    try {
      const data = await sessionsApi.createSession();
      setSessions([data, ...sessions]);
      setActiveSession(data);
      return data;
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSession = async (id) => {
    try {
      await sessionsApi.deleteSession(id);
      setSessions(sessions.filter(s => s.id !== id));
      if (activeSession?.id === id) {
        setActiveSession(sessions.length > 1 ? sessions.find(s => s.id !== id) : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return {
    sessions,
    activeSession,
    setActiveSession,
    loadSessions,
    createSession,
    deleteSession,
    isLoading
  };
}
