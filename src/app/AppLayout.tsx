"use client";

import React, { useState, useCallback } from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const toggleSidebar = useCallback(() => {
    setIsSidebarExpanded(prev => !prev);
  }, []);
  
  // Special layout for the daily attendance entry page
  if (pathname === '/production/attendance/daily-entry') {
    return <div className="min-h-screen bg-background">{children}</div>;
  }
  
  // No sidebar for login page
  if (pathname === '/login') {
      return <>{children}</>;
  }

  // On mobile, the margin is handled by the header, so it's always full width.
  // On desktop, the margin depends on the sidebar state.
  const mainContentMargin = isMobile ? '' : (isSidebarExpanded ? 'sm:ml-64' : 'sm:ml-14');

  return (
    <div className="w-full bg-background">
      <Sidebar isExpanded={isSidebarExpanded} onToggle={toggleSidebar} />
      <main className={cn("transition-[margin-left] duration-300 ease-in-out", mainContentMargin)}>
        <div className="overflow-x-auto p-4 md:p-8">
            {children}
        </div>
      </main>
    </div>
  );
}
