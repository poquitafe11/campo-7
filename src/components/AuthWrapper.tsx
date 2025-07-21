"use client";

import { useAuth } from '@/hooks/useAuth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const protectedRoutes = [
    '/dashboard',
    '/users',
    '/maestro-lotes',
    '/maestro-labores',
    '/asistentes',
    '/production',
];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
      
      if (!user && isProtectedRoute) {
        router.replace('/login');
      }
      
      if (user && pathname === '/login') {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Avoid rendering children on server-side if route is protected and no user info yet
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  if (typeof window === 'undefined' && isProtectedRoute) {
     return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user && isProtectedRoute) {
    return null; // or a loading spinner
  }
  
  if (user && pathname === '/login') {
    return null; // or a loading spinner
  }

  return <>{children}</>;
}
