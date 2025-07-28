
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  ClipboardList,
  Database,
  BarChart3,
  Box,
  ScrollText,
  Layers,
  Users,
  Settings,
  LogOut,
  Menu,
  Thermometer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import ConnectionStatus from './ConnectionStatus';

const navItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Áreas' },
  { href: '/maestro-lotes', icon: Box, label: 'Lotes' },
  { href: '/maestro-labores', icon: Layers, label: 'Labores' },
  { href: '/asistentes', icon: Users, label: 'Asistentes' },
  { href: '/min-max', icon: Thermometer, label: 'Mínimos y Máximos' },
  { href: '/presupuesto', icon: ScrollText, label: 'Presupuesto' },
  { href: '/production/activities/create', icon: ClipboardList, label: 'Registro de Actividades' },
];

const NavItem = ({ href, icon: Icon, label, isMobile }: { href: string; icon: React.ElementType; label: string; isMobile: boolean }) => {
  const pathname = usePathname();
  const linkContent = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-all hover:bg-sidebar-accent',
        pathname === href ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-muted-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );

  return isMobile ? <SheetClose asChild>{linkContent}</SheetClose> : linkContent;
};

const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => {
  const { profile, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="flex flex-col items-center p-6 space-y-4">
        <Avatar className="h-20 w-20 border-2 border-primary">
          <AvatarImage src={profile?.fotoURL || ''} alt={profile?.nombre} />
          <AvatarFallback className="text-3xl bg-primary/20 text-primary-foreground">
            {profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-bold text-center">{profile?.nombre}</h2>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} isMobile={isMobile} />
        ))}
      </nav>

      <div className="mt-auto p-6 space-y-4">
        <ConnectionStatus />
        <hr className="border-sidebar-muted-foreground/20" />
        <div className="text-sm text-sidebar-muted-foreground">Rol: {profile?.rol}</div>
        <Button
          onClick={logout}
          variant="ghost"
          className="w-full justify-start p-0 text-base font-medium h-auto hover:bg-transparent hover:text-sidebar-foreground text-sidebar-muted-foreground"
        >
          <LogOut className="mr-4 h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
};

const DesktopSidebar = () => {
  return (
    <aside className="hidden md:flex md:w-72">
      <NavContent />
    </aside>
  );
};

const Header = () => {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader>
            <SheetTitle className="sr-only">Menú Principal</SheetTitle>
          </SheetHeader>
          <NavContent isMobile={true} />
        </SheetContent>
      </Sheet>
    </header>
  );
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <DesktopSidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
