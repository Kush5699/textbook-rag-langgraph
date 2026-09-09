import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/common/Icon';

export default function SettingsPage() {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAdmin, updateUserProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [standard, setStandard] = useState('');
  const [school, setSchool] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || (user.email ? user.email.split('@')[0] : ''));
      setStandard(user.standard || 'Std 10');
      setSchool(user.school || '');
    }
  }, [user]);

  const handleCancel = () => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || (user.email ? user.email.split('@')[0] : ''));
      setStandard(user.standard || 'Std 10');
      setSchool(user.school || '');
    }
    setErrorMsg('');
    setIsEditing(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    setSaveSuccess(false);

    try {
      await updateUserProfile({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        standard: standard.trim(),
        school: school.trim(),
      });
      setSaveSuccess(true);
      setIsEditing(false); // Shrink menu back to view mode upon save
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setErrorMsg(err?.response?.data?.detail || 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const userInitial = name ? name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : 'U');

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-on-surface">Account Settings</h1>
        <p className="text-sm text-on-surface-variant mt-1">Manage your academic profile and application preferences.</p>
      </div>
      
      <div className="space-y-6">
        {/* Profile Details Card (Shrink / Expand Accordion) */}
        <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm transition-all overflow-hidden">
          {/* Header Bar with Toggle / Edit Button */}
          <div className="p-6 md:p-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-display font-bold text-lg shadow-sm flex-shrink-0">
                {userInitial}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-semibold text-on-surface">
                    {name || user?.username || 'Student User'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wider">
                    {isAdmin ? 'Admin' : (standard || 'Student')}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  @{username || (user?.email ? user.email.split('@')[0] : 'username')} • {user?.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  handleCancel();
                } else {
                  setIsEditing(true);
                  setErrorMsg('');
                }
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                isEditing
                  ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  : 'bg-primary text-on-primary hover:bg-primary/90'
              }`}
            >
              <Icon name={isEditing ? 'close' : 'edit'} style={{ fontSize: '15px' }} />
              <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
            </button>
          </div>

          {/* Shrinked View Mode (Summary info displayed when NOT editing) */}
          {!isEditing && (
            <div className="px-6 md:px-8 pb-6 pt-1 border-t border-outline-variant/40 bg-surface-container-lowest">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                <div>
                  <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider block">Full Name</span>
                  <p className="text-sm font-medium text-on-surface mt-0.5">{name || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider block">Username</span>
                  <p className="text-sm font-mono font-medium text-on-surface mt-0.5">@{username || 'user'}</p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider block">Class / Standard</span>
                  <p className="text-sm font-medium text-on-surface mt-0.5">{standard || 'Std 10'}</p>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider block">School / Board</span>
                  <p className="text-sm font-medium text-on-surface mt-0.5 truncate">{school || 'Gujarat State Board'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Expanded Edit Mode (Interactive form that shrinks upon saving) */}
          {isEditing && (
            <div className="p-6 md:p-8 pt-4 border-t border-outline-variant/60 bg-surface-container-low/30 animate-fadeIn">
              {saveSuccess && (
                <div className="bg-secondary/15 text-secondary border border-secondary/30 p-3 rounded-lg mb-5 text-sm flex items-center gap-2 font-medium">
                  <Icon name="check_circle" style={{ fontSize: '18px' }} />
                  Profile updated successfully!
                </div>
              )}

              {errorMsg && (
                <div className="bg-error/15 text-error border border-error/30 p-3 rounded-lg mb-5 text-sm flex items-center gap-2 font-medium">
                  <Icon name="error" style={{ fontSize: '18px' }} />
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                      Full Name
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 border border-outline-variant rounded-xl bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" 
                      placeholder="e.g. Talaksh Patel"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                      Username
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-on-surface-variant text-sm font-mono">@</span>
                      <input 
                        type="text" 
                        className="w-full pl-8 pr-3 p-2.5 border border-outline-variant rounded-xl bg-surface text-on-surface text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" 
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Email Address</label>
                  <input 
                    type="email" 
                    className="w-full p-2.5 border border-outline-variant/60 rounded-xl bg-surface/50 text-on-surface-variant text-sm cursor-not-allowed opacity-75 font-mono" 
                    value={user?.email || ''} 
                    disabled 
                  />
                  <p className="text-[11px] text-on-surface-variant/70 mt-1">Email is verified through authentication and cannot be changed directly.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                      Standard / Class
                    </label>
                    <select
                      value={standard}
                      onChange={(e) => setStandard(e.target.value)}
                      className="w-full p-2.5 border border-outline-variant rounded-xl bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="Std 9">Std 9 (Secondary)</option>
                      <option value="Std 10">Std 10 (SSC)</option>
                      <option value="Std 11">Std 11 (Higher Secondary)</option>
                      <option value="Std 12">Std 12 (HSC)</option>
                      <option value="Teacher / Faculty">Teacher / Faculty</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                      School / Institute
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 border border-outline-variant rounded-xl bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" 
                      placeholder="e.g. Gujarat Secondary School"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-full border border-outline-variant text-xs font-medium text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Icon name="progress_activity" className="animate-spin text-sm" /> Saving...
                      </>
                    ) : (
                      <>
                        <Icon name="save" style={{ fontSize: '16px' }} /> Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        {/* Preferences Section */}
        <section className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl border border-outline-variant shadow-sm transition-colors">
          <div className="mb-4 pb-3 border-b border-outline-variant/50">
            <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Icon name="tune" className="text-primary" /> Appearance & Preferences
            </h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-on-surface font-medium flex items-center gap-2">
                <Icon name={isDark ? 'dark_mode' : 'light_mode'} className="text-primary" />
                Dark Mode
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">Toggle dark theme for comfortable reading at night.</p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-14 h-7 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                isDark ? 'bg-primary' : 'bg-surface-container-highest'
              }`}
              aria-label="Toggle dark mode"
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full transition-transform bg-surface shadow-md flex items-center justify-center ${
                  isDark ? 'translate-x-8 text-primary' : 'translate-x-1 text-on-surface-variant'
                }`}
              >
                <Icon name={isDark ? 'dark_mode' : 'light_mode'} style={{ fontSize: '13px' }} />
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
