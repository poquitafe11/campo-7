
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Box,
  Layers,
  Users,
  Thermometer,
  ScrollText,
  LogOut,
  Menu,
  ArrowLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import ConnectionStatus from './ConnectionStatus';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';

const mainNavItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Áreas' },
  { href: '/maestros', icon: Layers, label: 'Maestros' },
  { href: '/users', icon: Shield, label: 'Usuarios' },
];

const allMaestrosItems = [
  { href: '/maestro-lotes', icon: Box, label: 'Lotes' },
  { href: '/maestro-labores', icon: Layers, label: 'Labores' },
  { href: '/maestro-trabajadores', icon: Users, label: 'Trabajadores' },
  { href: '/asistentes', icon: Users, label: 'Asistentes' },
  { href: '/min-max', icon: Thermometer, label: 'Mínimos y Máximos' },
  { href: '/presupuesto', icon: ScrollText, label: 'Presupuesto' },
];

const pageTitles: { [key: string]: string } = {
    '/dashboard': 'Áreas de Gestión',
    '/maestros': 'Datos Maestros',
    '/maestro-lotes': 'Maestro de Lotes',
    '/maestro-labores': 'Maestro de Labores',
    '/maestro-trabajadores': 'Maestro de Trabajadores',
    '/asistentes': 'Gestión de Asistentes',
    '/min-max': 'Maestro de Mínimos y Máximos',
    '/presupuesto': 'Maestro de Presupuesto',
    '/production': 'Producción',
    '/production/activities': 'Registro de Actividades',
    '/production/activities/create': 'Crear Ficha de Actividad',
    '/production/activities/database': 'Base de Datos de Actividades',
    '/production/activities/summary': 'Resumen de Actividades',
    '/production/attendance': 'Asistencia de Personal',
    '/production/attendance/daily-entry': 'Registro de Asistencia',
    '/production/attendance/database': 'Historial de Asistencia',
    '/production/attendance/summary': 'Resumen de Asistencia',
    '/production/daily-report': 'Parte Diario',
    '/production/daily-report/create': 'Crear Parte Diario',
    '/users': 'Gestión de Usuarios',
    '/health': 'Sanidad',
    '/health/register': 'Registro de Sanidad',
    '/health/summary': 'Resumen de Sanidad',
    '/irrigation': 'Riego',
    '/irrigation/register': 'Registro de Riego',
    '/irrigation/summary': 'Resumen de Riego',
    '/quality-control': 'Control de Calidad',
    '/biological-control': 'Control Biológico',
    '/queries': 'Asistente de Consultas IA',
    '/summary': 'Resumen de Datos',
  };


const NavItem = ({ href, icon: Icon, label, closeSheet }: { href: string; icon: React.ElementType; label: string; closeSheet: () => void; }) => {
    const pathname = usePathname();
    const isActive = pathname === href || (href === '/maestros' && allMaestrosItems.some(item => pathname.startsWith(item.href)));

    return (
      <SheetClose asChild>
        <Link
          href={href}
          onClick={closeSheet}
          className={cn(
            'flex items-center justify-between rounded-lg px-4 py-3 text-base font-medium transition-colors',
            isActive
              ? 'bg-sidebar-accent text-sidebar-foreground'
              : 'text-sidebar-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
          )}
        >
          <div className="flex items-center gap-4">
              <Icon className="h-5 w-5" />
              <span>{label}</span>
          </div>
          <ChevronRight className="h-5 w-5" />
        </Link>
      </SheetClose>
    );
  };

const MobileNavContent = ({ closeSheet }: { closeSheet: () => void }) => {
    const { profile, logout } = useAuth();
    
    return (
      <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
         <SheetHeader className="p-4 border-b border-sidebar-muted-foreground/20 text-left">
            <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-sidebar-accent">
                  <AvatarImage src={profile?.fotoURL || ''} alt={profile?.nombre} />
                  <AvatarFallback className="text-xl bg-primary/20 text-sidebar-foreground">
                  {profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}
                  </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <p className="text-base font-bold">{profile?.nombre}</p>
                <p className="text-xs text-sidebar-muted-foreground font-normal">Rol: {profile?.rol}</p>
              </div>
            </div>
         </SheetHeader>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {mainNavItems.map(item => (
            <NavItem {...item} key={item.href} closeSheet={closeSheet} />
          ))}
        </nav>

        <div className="mt-auto p-4 space-y-4 border-t border-sidebar-muted-foreground/20">
          <ConnectionStatus />
          <Button
            onClick={() => {
                logout();
                closeSheet();
            }}
            variant="ghost"
            className="w-full justify-start text-base font-medium h-auto p-2 hover:bg-sidebar-accent/50 text-sidebar-muted-foreground hover:text-sidebar-foreground"
          >
            <LogOut className="mr-4 h-5 w-5" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    );
  };

const Header = () => {
    const pathname = usePathname();
    const router = useRouter();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const { actions } = useHeaderActions();

    const title = pageTitles[pathname] || 'Campo 7';

    const renderDefaultHeader = () => (
        <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 border-b bg-background">
            <div className="flex items-center gap-2">
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Abrir menú</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                    <MobileNavContent closeSheet={() => setIsSheetOpen(false)} />
                </SheetContent>
                </Sheet>

                {pathname !== '/dashboard' && (
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
                    <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}

                <h1 className="text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                    {title}
                </h1>
            </div>

            <div className="flex items-center gap-1">
             {actions}
             <Button variant="ghost" size="icon" asChild className="h-9 w-9">
                <Link href="/dashboard">
                    <LayoutGrid className="h-5 w-5" />
                </Link>
            </Button>
            </div>
        </header>
    );

    return renderDefaultHeader();
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
