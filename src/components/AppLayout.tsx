
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
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
  ArrowLeft,
  Calendar as CalendarIcon,
  RefreshCcw,
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
  SheetDescription,
  SheetClose,
  SheetTrigger,
} from '@/components/ui/sheet';
import ConnectionStatus from './ConnectionStatus';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';

const navItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Áreas' },
  { href: '/maestro-lotes', icon: Box, label: 'Lotes' },
  { href: '/maestro-labores', icon: Layers, label: 'Labores' },
  { href: '/asistentes', icon: Users, label: 'Asistentes' },
  { href: '/min-max', icon: Thermometer, label: 'Mínimos y Máximos' },
  { href: '/presupuesto', icon: ScrollText, label: 'Presupuesto' },
  {
    href: '/production/activities/create',
    icon: ClipboardList,
    label: 'Registro de Actividades',
  },
];

const pageTitles: { [key: string]: string } = {
  '/dashboard': 'Áreas de Gestión',
  '/maestro-lotes': 'Maestro de Lotes',
  '/maestro-labores': 'Maestro de Labores',
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
  '/maestros': 'Datos Maestros',
};

const NavItem = ({
  href,
  icon: Icon,
  label,
  isMobile,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  isMobile?: boolean;
}) => {
  const pathname = usePathname();
  const LinkContent = () => (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-all hover:bg-sidebar-accent',
        pathname === href
          ? 'bg-sidebar-accent text-sidebar-foreground'
          : 'text-sidebar-muted-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );

  if (isMobile) {
    return (
      <SheetClose asChild>
        <LinkContent />
      </SheetClose>
    );
  }
  return <LinkContent />;
};

const MobileNavContent = () => {
  const { profile, logout } = useAuth();
  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
        <SheetHeader className="p-4 border-b border-sidebar-muted-foreground/20 text-left">
             <SheetTitle className="text-sidebar-foreground flex items-center gap-3">
                 <Avatar className="h-10 w-10 border-2 border-sidebar-accent">
                    <AvatarImage src={profile?.fotoURL || ''} alt={profile?.nombre} />
                    <AvatarFallback className="text-xl bg-primary/20 text-sidebar-foreground">
                    {profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}
                    </AvatarFallback>
                </Avatar>
                <span className="text-lg font-bold">{profile?.nombre}</span>
             </SheetTitle>
        </SheetHeader>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {navItems.map(item => (
          <NavItem {...item} key={item.href} isMobile />
        ))}
      </nav>

      <div className="mt-auto p-4 space-y-4 border-t border-sidebar-muted-foreground/20">
        <ConnectionStatus />
        <div className="text-sm text-sidebar-muted-foreground">
          Rol: {profile?.rol}
        </div>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = pageTitles[pathname] || 'Campo 7';
  const isDashboard = pathname === '/dashboard';
  const isAttendanceSummary = pathname === '/production/attendance/summary';
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  useEffect(() => {
    if (isAttendanceSummary) {
      const dateParam = searchParams.get('date');
      if (dateParam && isValid(parseISO(dateParam))) {
        setSelectedDate(parseISO(dateParam));
      } else {
        setSelectedDate(new Date());
      }
    }
  }, [isAttendanceSummary, searchParams]);

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const newPath = `${pathname}?date=${format(date, 'yyyy-MM-dd')}`;
      router.replace(newPath, { scroll: false });
    }
  };
  
  const handleRefresh = () => {
    if (selectedDate) {
        const newPath = `${pathname}?date=${format(selectedDate, 'yyyy-MM-dd')}&refresh=${new Date().getTime()}`;
        router.replace(newPath, { scroll: false });
    }
  }


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
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {isAttendanceSummary && (
           <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCcw className="h-4 w-4" />
            </Button>
            <Popover>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={'outline'}
                    size="sm"
                    className={cn(
                    'w-[240px] justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateChange}
                    initialFocus
                    locale={es}
                    />
            </PopoverContent>
            </Popover>
          </div>
        )}
        {!isDashboard && (
          <>
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" asChild>
              <Link href="/dashboard">
                <LayoutGrid className="h-4 w-4" />
              </Link>
            </Button>
          </>
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
