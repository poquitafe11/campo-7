
"use client";

import { useAuth } from '@/hooks/useAuth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const protectedRoutes = [
    '/dashboard',
    '/users',
    '/maestros',
    '/maestro-lotes',
    '/maestro-labores',
    '/maestro-trabajadores',
    '/asistentes',
    '/min-max',
    '/presupuesto',
    '/production',
    '/health',
    '/irrigation',
    '/quality-control',
    '/quality-control/phenology',
    '/biological-control',
    '/queries',
    '/summary',
    '/maps',
];

const adminRoutes = [
    '/users'
];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    
    if (!user && isProtectedRoute) {
      router.replace('/login');
      return;
    }
    
    if (user && pathname === '/login') {
      router.replace('/dashboard');
      return;
    }
    
    // Permission check for logged in users
    if (user && profile && isProtectedRoute) {
      if(profile.rol !== 'Admin') {
        const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
        if (isAdminRoute) {
            router.replace('/dashboard');
            return;
        }

        const requiredPermission = protectedRoutes.find(route => pathname.startsWith(route) && route !== '/dashboard' && route !== '/maestros');
        
        if (requiredPermission && (!profile.permissions || profile.permissions[requiredPermission] !== true)) {
            router.replace('/dashboard');
            return;
        }
      }
    }

  }, [user, profile, loading, pathname, router]);


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
