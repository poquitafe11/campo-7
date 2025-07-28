
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Box,
  Layers,
  Users,
  Thermometer,
  ScrollText,
  ClipboardList,
  LogOut,
  Menu,
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

const NavItem = ({ href, icon: Icon, label, isMobile }: { href: string; icon: React.ElementType; label: string; isMobile?: boolean }) => {
  const pathname = usePathname();
  const LinkContent = () => (
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

  if (isMobile) {
    return <SheetClose asChild><LinkContent /></SheetClose>;
  }
  return <LinkContent />;
};


const MobileNavContent = () => {
  const { profile, logout } = useAuth();
  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <SheetHeader className="p-4 border-b border-sidebar-muted-foreground/20">
         <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex flex-col items-center p-2 space-y-2">
           <Avatar className="h-16 w-16 border-2 border-sidebar-accent">
            <AvatarImage src={profile?.fotoURL || ''} alt={profile?.nombre} />
            <AvatarFallback className="text-2xl bg-primary/20 text-sidebar-foreground">
              {profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-lg font-bold text-center">{profile?.nombre}</h2>
        </div>
      </SheetHeader>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem {...item} key={item.href} isMobile />
        ))}
      </nav>

      <div className="mt-auto p-4 space-y-4 border-t border-sidebar-muted-foreground/20">
        <ConnectionStatus />
        <div className="text-sm text-sidebar-muted-foreground">Rol: {profile?.rol}</div>
        <SheetClose asChild>
          <Button
            onClick={logout}
            variant="ghost"
            className="w-full justify-start p-0 text-base font-medium h-auto hover:bg-transparent hover:text-sidebar-foreground text-sidebar-muted-foreground"
          >
            <LogOut className="mr-4 h-5 w-5" />
            Cerrar Sesión
          </Button>
        </SheetClose>
      </div>
    </div>
  );
};

const Header = () => {
  const pathname = usePathname();
  const isDashboard = pathname === '/dashboard';

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <MobileNavContent />
          </SheetContent>
        </Sheet>
        {isDashboard && (
          <h1 className="text-xl font-bold tracking-tight text-foreground">Áreas de Gestión</h1>
        )}
      </div>
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
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
