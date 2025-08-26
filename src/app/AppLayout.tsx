"use client";

import React from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
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
        <main className="transition-[margin-left] duration-300 ease-in-out md:ml-20 pt-16 md:pt-0">
          <div className="overflow-x-auto p-4 md:p-8">
              {children}
          </div>
        </main>
      </div>
    </HeaderActionsProvider>
  );
}
