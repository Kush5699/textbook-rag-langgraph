import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function TopAppBar({ onToggleSidebar }) {
  const { user, isAdmin, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const userInitial = user?.name ? user.name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : 'U');

  return (
    <header className="h-[64px] sticky top-0 z-10 bg-surface/90 backdrop-blur border-b border-outline-variant flex items-center justify-between px-4 sm:px-6 flex-shrink-0 transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
          title="Toggle Navigation and Chat History"
        >
          <Icon name="menu" style={{ fontSize: '22px' }} />
        </button>
        <Link
          to="/app/chat"
          className="flex items-center gap-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg p-1"
          title="Go to Research Chat Dashboard"
        >
          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <Icon name="school" style={{ fontSize: '18px' }} />
          </span>
          <span className="text-body-md font-semibold text-on-surface flex items-center gap-2">
            <span className="hidden sm:inline group-hover:text-primary transition-colors">GSSTB Scholar</span>
            <span className="text-xs font-normal text-on-surface-variant hidden md:inline">Gujarat Board Study RAG</span>
          </span>
        </Link>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4 ml-4">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <Icon name={isDark ? 'light_mode' : 'dark_mode'} style={{ fontSize: '20px' }} />
        </button>

        {isAdmin ? (
          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            Admin
          </span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-medium uppercase tracking-wider">
            Student
          </span>
        )}
        <div className="flex items-center gap-3 border-l border-outline-variant pl-3 sm:pl-4">
          <Link
            to="/app/settings"
            className="flex items-center gap-2.5 p-1.5 -ml-1.5 rounded-xl hover:bg-surface-container transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
            title="Open Account Settings"
          >
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-semibold text-sm shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              {userInitial}
            </div>
            <div className="hidden sm:flex flex-col text-left max-w-[140px] md:max-w-[170px]">
              <span className="text-body-sm font-semibold text-on-surface group-hover:text-primary transition-colors truncate leading-tight">
                {user?.name || user?.username || 'Student'}
              </span>
              <span className="text-[11px] text-on-surface-variant truncate leading-tight font-mono">
                @{user?.username || (user?.email ? user.email.split('@')[0] : 'user')}
              </span>
            </div>
          </Link>

          <button 
            onClick={logout} 
            className="text-body-sm text-error hover:underline flex items-center gap-1 font-medium ml-1"
            title="Sign Out"
          >
            <Icon name="logout" className="text-base" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
