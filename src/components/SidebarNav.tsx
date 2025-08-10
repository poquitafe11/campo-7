
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  ClipboardList,
  HeartPulse,
  Droplets,
  BadgeCheck,
  Bug,
  Lightbulb,
  PieChart,
  Users,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMemo } from 'react';

const allLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/maestros', label: 'Maestros', icon: Settings },
  { href: '/production', label: 'Producción', icon: ClipboardList },
  { href: '/health', label: 'Sanidad', icon: HeartPulse },
  { href: '/irrigation', label: 'Riego', icon: Droplets },
  { href: '/quality-control', label: 'C. Calidad', icon: BadgeCheck },
  { href: '/biological-control', label: 'C. Biológico', icon: Bug },
  { href: '/queries', label: 'Consultas IA', icon: Lightbulb },
  { href: '/summary', label: 'Resumen', icon: PieChart },
  { href: '/users', label: 'Usuarios', icon: Users },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  const visibleLinks = useMemo(() => {
    if (!profile) return [];
    if (profile.rol === 'Admin') {
      return allLinks;
    }
    const userPermissions = profile.permissions || {};
    return allLinks.filter(link => {
      if (link.href === '/dashboard' || link.href === '/maestros') return true; // Always show dashboard and maestros
      // For other sections, check permissions
      return userPermissions[link.href];
    });
  }, [profile]);
  
  const isActive = (href: string) => {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  };

  return (
    <nav className="grid items-start gap-2 px-2 text-sm font-medium lg:px-4">
      {visibleLinks.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
            isActive(href) && 'bg-muted text-primary'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
