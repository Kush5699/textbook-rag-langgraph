import React from 'react';
import Icon from '../common/Icon';
import { useAuth } from '../../contexts/AuthContext';

export default function TopAppBar({ onToggleSidebar }) {
  const { user, isAdmin, logout } = useAuth();

  const userInitial = user?.email ? user.email[0].toUpperCase() : 'U';

  return (
    <header className="h-[64px] sticky top-0 z-10 bg-surface/90 backdrop-blur border-b border-outline-variant flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
          title="Toggle Navigation and Chat History"
        >
          <Icon name="menu" style={{ fontSize: '22px' }} />
        </button>
        <span className="text-body-md font-semibold text-on-surface flex items-center gap-2">
          <span className="hidden sm:inline">GSSTB Scholar</span>
          <span className="text-xs font-normal text-on-surface-variant hidden md:inline">Gujarat Board Study RAG</span>
        </span>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4 ml-4">
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
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-semibold text-sm shadow-sm">
            {userInitial}
          </div>
          <span className="text-body-sm text-on-surface hidden lg:inline max-w-[160px] truncate">
            {user?.email}
          </span>
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
