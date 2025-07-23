"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// This component ensures AppLayout is only rendered on the client side,
// which is crucial for preventing hydration errors with PWA/auth logic.
const AppLayout = dynamic(() => import('@/components/AppLayout'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  ),
});

export default function DynamicAppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, loading } = useAuth();
    
    // If we're on the login page, just render the children (the login page itself)
    // without the main AppLayout wrapper.
    if (pathname === '/login') {
        return <>{children}</>;
    }

    // While loading auth state or if no user is logged in on a protected page,
    // we show a loader (which AuthWrapper will handle), so we don't render AppLayout yet.
    if (loading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    // Once the user is authenticated and we're on a protected page, render the full AppLayout.
    return <AppLayout>{children}</AppLayout>;
}
