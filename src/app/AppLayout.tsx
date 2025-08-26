"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWindowSize } from '@/hooks/use-window-size';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { width } = useWindowSize();
  
  // Default to collapsed on mobile, expanded on desktop
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(width >= 768);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarExpanded(false);
    } else {
      setIsSidebarExpanded(true);
    }
  }, [isMobile]);
  
  // Special layout for the daily attendance entry page
  if (pathname === '/production/attendance/daily-entry') {
    return <div className="min-h-screen bg-background">{children}</div>;
  }
  
  // No sidebar for login page
  if (pathname === '/login') {
      return <>{children}</>;
  }

  return (
    <div className="w-full bg-background">
      <Sidebar isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
      <main className={cn(
          "transition-[margin-left] duration-300 ease-in-out",
          isSidebarExpanded ? "ml-64" : "ml-20"
        )}>
        <div className="overflow-x-auto p-4 md:p-8">
            {children}
        </div>
      </main>
    </div>
  );
}
