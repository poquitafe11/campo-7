
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
    '/min-max'
];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    
    if (!user && isProtectedRoute) {
      router.replace('/login');
    }
    
    if (user && pathname === '/login') {
      router.replace('/dashboard');
    }
  }, [user, loading, pathname, router]);


  if (loading) {
     return (
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
  }
  
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  if (isProtectedRoute && !user) {
    return null; 
  }

  if(pathname === '/login' && user) {
    return null;
  }

  return <>{children}</>;
}
