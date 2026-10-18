'use client';

import Sidebar from '@/components/portal/Sidebar';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#F8F9FA',
        fontFamily: 'Inter, "Noto Naskh Arabic", Cairo, sans-serif',
      }}
    >
      <Sidebar />
      {/* Main content area — offset by sidebar width on the right */}
      <main
        id="main-content"
        style={{
          marginRight: '260px',
          padding: '32px',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </main>
    </div>
  );
}
