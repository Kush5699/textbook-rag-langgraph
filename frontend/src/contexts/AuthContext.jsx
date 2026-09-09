import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
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
        name: userData.name || '',
        username: userData.username || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'user'),
        standard: userData.standard || '',
        school: userData.school || '',
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
        name: '',
        username: firebaseUser.email ? firebaseUser.email.split('@')[0] : 'user',
        standard: '',
        school: '',
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
      // Send verification link to user's real email
      try {
        await sendEmailVerification(credential.user);
      } catch (verifErr) {
        console.warn('Could not send verification email:', verifErr);
      }
      const syncedUser = await syncUserWithBackend(credential.user);
      return syncedUser;
    } finally {
      setLoading(false);
    }
  }, [syncUserWithBackend]);

  const resetPassword = useCallback(async (email) => {
    return await sendPasswordResetEmail(auth, email);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (auth.currentUser) {
      return await sendEmailVerification(auth.currentUser);
    }
    throw new Error('No user is currently signed in');
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUserProfile = useCallback(async (profileData) => {
    const updated = await authApi.updateProfile(profileData);
    setUser((prev) => ({
      ...prev,
      name: updated.name,
      username: updated.username,
      standard: updated.standard,
      school: updated.school,
    }));
    return updated;
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    resetPassword,
    resendVerificationEmail,
    updateUserProfile,
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
