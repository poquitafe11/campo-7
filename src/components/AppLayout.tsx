
"use client";

import React from 'react';
import { Sidebar } from '@/components/ui/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
