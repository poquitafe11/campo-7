"use client";

import React from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Special layout for the daily attendance entry page to match the reference image
  if (pathname === '/production/attendance/daily-entry') {
    return <div className="min-h-screen bg-background">{children}</div>;
  }
  
  // No sidebar for login page
  if (pathname === '/login') {
      return <>{children}</>;
  }

  return (
    <div className="w-full bg-background">
      <Sidebar />
      <main className="sm:ml-64">
        <div className="overflow-x-auto p-4 md:p-8">
            {children}
        </div>
      </main>
    </div>
  );
}
