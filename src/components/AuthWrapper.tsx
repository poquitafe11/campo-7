
"use client";

import { useAuth } from '@/hooks/useAuth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
    '/tarde',
];

const adminRoutes = [
    '/users'
];

import LoadingScreen from '@/components/LoadingScreen';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Add a state to track if the initial auth check has been passed.
  const [initialAuthPassed, setInitialAuthPassed] = useState(false);

  useEffect(() => {
    if (loading) return;

    // Once not loading, we mark initial auth as passed.
    setInitialAuthPassed(true);

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


  // Only show the main loader ONCE on the very first load of the app.
  if (loading && !initialAuthPassed) {
     return <LoadingScreen message="Iniciando sesión..." />;
  }
  
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  if (isProtectedRoute && !user) {
    // Don't render protected content if user is not logged in.
    // The useEffect will handle the redirect.
    return null; 
  }

  if(pathname === '/login' && user) {
     // Don't render login page if user is already logged in.
     // The useEffect will handle the redirect.
    return null;
  }

  return <>{children}</>;
}
