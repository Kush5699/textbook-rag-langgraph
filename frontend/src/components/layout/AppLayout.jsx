import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopAppBar from './TopAppBar';
import { ChatProvider } from '../../contexts/ChatContext';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <ChatProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopAppBar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ChatProvider>
  );
}
