import React from 'react';

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-headline-lg mb-8">Settings</h1>
      
      <div className="space-y-6">
        <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant">
          <h2 className="text-headline-md mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1">Name</label>
              <input type="text" className="w-full p-2 border border-outline-variant rounded-lg bg-surface" defaultValue="Admin User" />
            </div>
            <div>
              <label className="block text-label-md text-on-surface-variant mb-1">Email</label>
              <input type="email" className="w-full p-2 border border-outline-variant rounded-lg bg-surface" defaultValue="admin@gsstb.edu.in" disabled />
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant">
          <h2 className="text-headline-md mb-4">Preferences</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body-lg">Dark Mode</p>
              <p className="text-body-sm text-on-surface-variant">Toggle dark theme for the interface.</p>
            </div>
            <div className="w-12 h-6 bg-surface-container-highest rounded-full relative cursor-pointer">
              <div className="absolute left-1 top-1 w-4 h-4 bg-outline rounded-full" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
