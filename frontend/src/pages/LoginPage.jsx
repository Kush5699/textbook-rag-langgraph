import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/common/Icon';
import AmbientGradient from '../components/landing/AmbientGradient';

import { validateEmail as verifyEmailWithServer } from '../api/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const { login, register, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Known temporary / burner email domains
  const DISPOSABLE_EMAIL_DOMAINS = [
    'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'sharklasers.com',
    'mailinator.com', 'dispostable.com', 'yopmail.com', 'throwawaymail.com',
    'fakeinbox.com', 'getairmail.com', 'mohmal.com', 'crazymailing.com',
    'inboxkitten.com', 'generator.email', 'trashmail.com', 'nada.ltd',
    'armyspy.com', 'cuvox.de', 'dayrep.com', 'einrot.com', 'fleckens.hu',
    'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us'
  ];

  const validateEmailFormat = (rawEmail) => {
    const trimmed = rawEmail.trim().toLowerCase();
    // Standard RFC-compliant email regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, message: 'Please enter a valid email address (e.g. name@example.com).' };
    }

    const domain = trimmed.split('@')[1];
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      return { valid: false, message: 'Disposable/temporary emails are not allowed. Please use your real email.' };
    }

    return { valid: true, email: trimmed };
  };

  const verifyEmailDomain = async (trimmedEmail) => {
    try {
      await verifyEmailWithServer(trimmedEmail);
      return { valid: true };
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Invalid or non-existent email domain.';
      return { valid: false, message: msg };
    }
  };

  const getFirebaseErrorMessage = (code) => {
    const messages = {
      'auth/email-already-in-use': 'This email is already registered. Try signing in.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Incorrect email or password. Please try again.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return messages[code] || `Authentication error: ${code}`;
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const formatCheck = validateEmailFormat(email);
    if (!formatCheck.valid) {
      setError(formatCheck.message);
      return;
    }

    setIsLoading(true);
    try {
      // Check if domain exists on internet
      const domainCheck = await verifyEmailDomain(formatCheck.email);
      if (!domainCheck.valid) {
        setError(domainCheck.message);
        return;
      }

      await resetPassword(formatCheck.email);
      setSuccessMsg(`Password reset link sent to ${formatCheck.email}! Check your inbox (and spam folder).`);
    } catch (err) {
      if (err?.code?.startsWith('auth/')) {
        setError(getFirebaseErrorMessage(err.code));
      } else {
        setError(err?.message || 'Failed to send password reset email.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const formatCheck = validateEmailFormat(email);
    if (!formatCheck.valid) {
      setError(formatCheck.message);
      return;
    }

    setIsLoading(true);

    try {
      if (isRegister) {
        // Strict domain and MX resolution check before allowing registration
        const domainCheck = await verifyEmailDomain(formatCheck.email);
        if (!domainCheck.valid) {
          setError(domainCheck.message);
          return;
        }

        await register(formatCheck.email, password);
        setSuccessMsg('Account created! A verification link has been sent to your email. Please verify before proceeding.');
        setIsRegister(false);
      } else {
        await login(formatCheck.email, password);
        navigate('/app');
      }
    } catch (err) {
      // Firebase errors have codes starting with 'auth/'
      if (err?.code?.startsWith('auth/')) {
        setError(getFirebaseErrorMessage(err.code));
      } else {
        // Backend or network error
        const detail = err?.response?.data?.detail;
        setError(detail || err?.message || 'Something went wrong. Check the console.');
        console.error('Auth error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden">
      <AmbientGradient />
      
      <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-lg w-full max-w-md relative z-10 border border-outline-variant/30">
          <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-on-primary mx-auto mb-4 shadow-sm">
            <Icon name="school" className="text-3xl" />
          </div>
          <h1 className="text-2xl font-display font-bold text-on-surface">GSSTB Scholar</h1>
          <p className="text-sm text-on-surface-variant mt-2">
            {isForgotPassword 
              ? 'Reset Your Password' 
              : (isRegister ? 'Create your account' : 'Academic Workspace Sign In')}
          </p>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <Icon name="error" style={{ fontSize: '18px' }} />
            {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-secondary-container text-on-secondary-container p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <Icon name="check_circle" style={{ fontSize: '18px' }} />
            {successMsg}
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">
                Account Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-lg border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary text-on-surface"
                placeholder="student@example.com"
                required
              />
              <p className="text-xs text-on-surface-variant mt-1">
                Enter your registered email address and we'll send you a password reset link.
              </p>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-primary text-on-primary py-3 rounded-full font-medium hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? 'Sending...' : 'Send Password Reset Email'}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
                className="text-sm text-primary hover:underline font-medium"
              >
                &larr; Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">
                {isRegister ? 'Email' : 'Student ID (Email)'}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-lg border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary text-on-surface"
                placeholder="student@example.com"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-on-surface">Password</label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(''); setSuccessMsg(''); }}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 pr-11 rounded-lg border border-outline-variant bg-surface focus:outline-none focus:ring-2 focus:ring-primary text-on-surface"
                  placeholder="Enter your password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 p-1.5 text-on-surface-variant hover:text-primary transition-colors focus:outline-none rounded-md"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} style={{ fontSize: '20px' }} />
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-primary text-on-primary py-3 rounded-full font-medium hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Sign In')}
            </button>
          </form>
        )}

        {!isForgotPassword && (
          <p className="text-center text-sm text-on-surface-variant mt-6">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <button 
                  onClick={() => { setIsRegister(false); setError(''); setSuccessMsg(''); }}
                  className="text-primary hover:underline font-medium"
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                Need an account?{' '}
                <button 
                  onClick={() => { setIsRegister(true); setError(''); setSuccessMsg(''); }}
                  className="text-primary hover:underline font-medium"
                >
                  Register
                </button>
              </>
            )}
          </p>
        )}

        <p className="text-center text-xs text-on-surface-variant/60 mt-4">
          First registered user becomes the admin.
        </p>
      </div>
    </div>
  );
}
