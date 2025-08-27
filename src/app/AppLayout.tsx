"use client";

import React, { useState } from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { HeaderActionsProvider } from '@/contexts/HeaderActionsContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const isMobile = useIsMobile();

  if (pathname === '/login') {
      return <>{children}</>;
  }

  return (
    <HeaderActionsProvider>
      <div className="w-full bg-background">
        <Sidebar
          isExpanded={isSidebarExpanded}
          setIsExpanded={setIsSidebarExpanded}
        />
        <main
          className={cn(
            'transition-[margin-left] duration-300 ease-in-out',
            isMobile ? 'ml-0' : (isSidebarExpanded ? 'ml-64' : 'ml-20')
          )}
        >
          <div className="overflow-x-auto p-4 md:p-8 pt-20 md:pt-8">
              {children}
          </div>
        </main>
      </div>
    </HeaderActionsProvider>
  );
}
