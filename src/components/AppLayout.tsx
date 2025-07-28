
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Layers,
  Tractor,
  Users,
  PanelLeft,
  LogOut,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const navItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { 
    label: "Maestros", 
    icon: Layers, 
    href: "/maestros",
    subItems: [
        { href: "/maestro-lotes", label: "Lotes" },
        { href: "/maestro-labores", label: "Labores" },
        { href: "/asistentes", label: "Asistentes" },
        { href: "/min-max", label: "Min y Max" },
        { href: "/presupuesto", label: "Presupuesto" },
    ]
  },
  { 
    label: "Producción", 
    icon: Tractor, 
    href: "/production",
    subItems: [
        { href: "/production/attendance", label: "Asistencia" },
        { href: "/production/daily-report", label: "Parte Diario" },
        { href: "/production/activities", label: "Actividades" },
    ]
  },
  { href: '/users', icon: Users, label: 'Usuarios' },
];

const Sidebar = () => {
  const pathname = usePathname();
  const { profile, logout, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const isParentActive = (itemHref: string) => {
    if (!itemHref) return false;
    if (itemHref === '/dashboard') return pathname === itemHref;
    return pathname.startsWith(itemHref);
  };
  
  const isChildActive = (href: string) => {
    return pathname === href;
  };

  return (
    <TooltipProvider delayDuration={0}>
        <aside
        className={cn(
            'hidden md:flex flex-col border-r transition-all duration-300 ease-in-out bg-sidebar text-sidebar-foreground',
            isCollapsed ? 'w-16' : 'w-64'
        )}
        >
        <div className="flex items-center h-16 border-b border-sidebar-border px-4 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
                <Avatar className={cn('h-8 w-8 transition-all', isCollapsed ? 'h-8 w-8' : 'h-8 w-8')}>
                    <AvatarImage src={'/logo.png'} alt="Campo 7" />
                    <AvatarFallback>C7</AvatarFallback>
                </Avatar>
            <span className={cn('font-bold transition-opacity whitespace-nowrap', isCollapsed && 'opacity-0 w-0 h-0 hidden')}>Campo 7</span>
            </Link>
        </div>
        <nav className="flex-1 space-y-1 p-2">
            {navItems.map((item) =>
                item.subItems ? (
                <Collapsible key={item.label} defaultOpen={isParentActive(item.href)} className="space-y-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <CollapsibleTrigger className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-sidebar-primary-foreground hover:bg-sidebar-accent w-full", isParentActive(item.href) && "bg-sidebar-accent text-sidebar-primary-foreground", isCollapsed && 'justify-center')}>
                                <item.icon className="h-5 w-5 shrink-0" />
                                <span className={cn('truncate', isCollapsed && 'hidden')}>{item.label}</span>
                                <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 transition-transform', isCollapsed && 'hidden')} />
                            </CollapsibleTrigger>
                        </TooltipTrigger>
                        {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                    </Tooltip>
                    <CollapsibleContent className={cn("space-y-1", isCollapsed && 'hidden')}>
                    {item.subItems.map((subItem) => (
                        <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={cn('flex items-center gap-3 rounded-lg py-2 transition-all hover:text-sidebar-primary-foreground hover:bg-sidebar-accent', isChildActive(subItem.href) ? 'bg-sidebar-accent text-sidebar-primary-foreground' : 'text-sidebar-foreground/80', isCollapsed ? 'px-3 justify-center' : 'pl-11 pr-3')}
                        >
                            <span className="truncate text-sm">{subItem.label}</span>
                        </Link>
                    ))}
                    </CollapsibleContent>
                </Collapsible>
                ) : (
                <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                    <Link
                        href={item.href}
                        className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-sidebar-primary-foreground hover:bg-sidebar-accent',
                        isParentActive(item.href) ? 'bg-sidebar-accent text-sidebar-primary-foreground' : 'text-sidebar-foreground/80',
                        isCollapsed && 'justify-center'
                        )}
                    >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className={cn(isCollapsed && 'hidden')}>{item.label}</span>
                    </Link>
                    </TooltipTrigger>
                    {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                </Tooltip>
                )
            )}
        </nav>
        <div className="mt-auto p-2 border-t border-sidebar-border">
            <div className="flex items-center w-full">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className={cn('w-full hover:bg-sidebar-accent justify-between', isCollapsed ? 'p-0 h-10' : 'justify-start gap-2 p-2 h-12')}>
                            <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user?.photoURL || ''} alt={profile?.nombre} />
                                    <AvatarFallback>{profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                                </Avatar>
                                <div className={cn("flex flex-col items-start", isCollapsed && 'hidden')}>
                                    <span className="text-sm font-medium truncate text-sidebar-foreground">{profile?.nombre || 'Usuario'}</span>
                                    <span className="text-xs text-sidebar-foreground/70">{profile?.rol || 'Rol'}</span>
                                </div>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-56">
                        <DropdownMenuLabel>{profile?.nombre}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Configuración</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={logout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Cerrar Sesión</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                 <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className={cn('ml-auto shrink-0 hover:bg-sidebar-accent', isCollapsed ? 'hidden' : 'flex')}>
                    <PanelLeft className="h-5 w-5" />
                </Button>
            </div>
        </div>
        </aside>
    </TooltipProvider>
  );
};

const MobileBottomNav = () => {
  const pathname = usePathname();
  const { logout, profile } = useAuth();
  const router = useRouter();

  const handleNavigation = (href: string) => {
    router.push(href);
  };
  
  const isParentActive = (item: (typeof navItems[0])) => {
     if (!item.href) return false;
     if (item.href === '/dashboard') return pathname === item.href;
     return pathname.startsWith(item.href);
  };

  return (
    <footer className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm">
      <nav className="grid grid-cols-5 items-center justify-items-center h-16">
        {navItems.filter(item => !item.subItems).map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 p-2 rounded-md text-muted-foreground transition-colors hover:text-primary',
              isParentActive(item) && 'text-primary'
            )}
          >
            <item.icon className="h-6 w-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-center gap-1 p-2 rounded-md text-muted-foreground transition-colors hover:text-primary">
                    <Avatar className="h-6 w-6">
                        <AvatarFallback>{profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] font-medium">Perfil</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="mb-2">
                <DropdownMenuLabel>{profile?.nombre}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigation("#")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configuración</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </footer>
  );
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className={cn('flex-1 p-4 sm:p-6 overflow-y-auto', isMobile && 'pb-24')}>
           {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
