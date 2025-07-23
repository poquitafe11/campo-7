"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const AppLayout = dynamic(() => import('@/components/AppLayout'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  ),
});

export default function DynamicAppLayout({ children }: { children: React.ReactNode }) {
    return <AppLayout>{children}</AppLayout>;
}
