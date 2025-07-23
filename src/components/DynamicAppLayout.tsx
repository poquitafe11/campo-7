"use client";

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// This component ensures AppLayout is only rendered on the client side,
// which is crucial for preventing hydration errors with PWA/auth logic.
const AppLayout = dynamic(() => import('@/components/AppLayout'), {
  ssr: false,
});

export default function DynamicAppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    
    // If we're on the login page, just render the children (the login page itself)
    // without the main AppLayout wrapper.
    if (pathname === '/login') {
        return <>{children}</>;
    }
    
    // Once the user is authenticated and we're on a protected page, render the full AppLayout.
    return <AppLayout>{children}</AppLayout>;
}
