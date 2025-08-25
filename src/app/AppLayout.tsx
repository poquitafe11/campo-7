"use client";

import React, { useState, useCallback } from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  
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
      <Sidebar />
      <main className={cn("transition-[margin-left] duration-300 ease-in-out", !isMobile ? "sm:ml-64" : "")}>
        <div className="overflow-x-auto p-4 md:p-8">
            {children}
        </div>
      </main>
    </div>
  );
}
