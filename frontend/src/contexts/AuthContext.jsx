import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync Firebase user with local SQLite backend
  const syncUserWithBackend = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setUser(null);
      return null;
    }

    try {
      const userData = await authApi.syncUser();
      const fullUser = {
        id: userData.id,
        email: firebaseUser.email,
        role: userData.role,
        firebaseUid: firebaseUser.uid,
      };
      setUser(fullUser);
      return fullUser;
    } catch (error) {
      console.warn('Backend sync warning, using basic Firebase profile:', error);
      const basicUser = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        role: 'customer',
        firebaseUid: firebaseUser.uid,
      };
      setUser(basicUser);
      return basicUser;
    }
  }, []);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await syncUserWithBackend(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncUserWithBackend]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const syncedUser = await syncUserWithBackend(credential.user);
      return syncedUser;
    } finally {
      setLoading(false);
    }
  }, [syncUserWithBackend]);

  const register = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const syncedUser = await syncUserWithBackend(credential.user);
      return syncedUser;
    } finally {
      setLoading(false);
    }
  }, [syncUserWithBackend]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAdmin: user?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
