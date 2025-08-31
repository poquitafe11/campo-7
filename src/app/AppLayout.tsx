
"use client";

import React, from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { HeaderActionsProvider } from '@/contexts/HeaderActionsContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
      return <>{children}</>;
  }

  return (
    <HeaderActionsProvider>
      <div className="w-full bg-background">
        <Sidebar />
        <main className="pt-16">
          <div className="overflow-x-auto p-4 md:p-8">
              {children}
          </div>
        </main>
      </div>
    </HeaderActionsProvider>
  );
}
