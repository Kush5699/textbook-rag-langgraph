import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/common/Icon';
import AmbientGradient from '../components/landing/AmbientGradient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const getFirebaseErrorMessage = (code) => {
    const messages = {
      'auth/email-already-in-use': 'This email is already registered. Try signing in.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Incorrect email or password. Please try again.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return messages[code] || `Authentication error: ${code}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
        navigate('/app');
      } else {
        await login(email, password);
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
            {isRegister ? 'Create your account' : 'Academic Workspace Sign In'}
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
            <label className="block text-sm font-medium text-on-surface mb-1">Password</label>
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

        <p className="text-center text-xs text-on-surface-variant/60 mt-4">
          First registered user becomes the admin.
        </p>
      </div>
    </div>
  );
}
