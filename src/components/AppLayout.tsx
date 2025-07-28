
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Layers,
  Tractor,
  Users,
  PanelLeft,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose
} from '@/components/ui/sheet';
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

const NavContent = () => {
  const pathname = usePathname();

  const isParentActive = (itemHref: string) => {
    if (!itemHref) return false;
    if (itemHref === '/dashboard') return pathname === itemHref;
    return pathname.startsWith(itemHref);
  };
  
  const isChildActive = (href: string) => {
    return pathname === href;
  };

  return (
    <nav className="flex-1 space-y-1 p-2">
      {navItems.map((item) =>
        item.subItems ? (
          <Collapsible key={item.label} defaultOpen={isParentActive(item.href)} className="space-y-1">
            <CollapsibleTrigger className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary-foreground hover:bg-accent w-full data-[state=open]:bg-accent data-[state=open]:text-primary-foreground">
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
              <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
              {item.subItems.map((subItem) => (
                <SheetClose asChild key={subItem.href}>
                  <Link
                    href={subItem.href}
                    className={cn('flex items-center gap-3 rounded-lg py-2 transition-all hover:text-primary-foreground hover:bg-accent', isChildActive(subItem.href) ? 'bg-accent text-primary-foreground' : 'text-muted-foreground', 'pl-11 pr-3')}
                  >
                    <span className="truncate text-sm">{subItem.label}</span>
                  </Link>
                </SheetClose>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <SheetClose asChild key={item.href}>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary-foreground hover:bg-accent',
                isParentActive(item.href) ? 'bg-accent text-primary-foreground' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          </SheetClose>
        )
      )}
    </nav>
  );
};


const DesktopSidebar = () => {
  const pathname = usePathname();
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
            'hidden md:flex flex-col border-r transition-all duration-300 ease-in-out bg-card text-card-foreground',
            isCollapsed ? 'w-16' : 'w-64'
        )}
        >
        <div className="flex items-center h-16 border-b px-4 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                <Avatar className={cn('h-8 w-8 transition-all', isCollapsed ? 'h-8 w-8' : 'h-8 w-8')}>
                    <AvatarImage src={'/logo.png'} alt="Campo 7" />
                    <AvatarFallback>C7</AvatarFallback>
                </Avatar>
            <span className={cn('font-bold transition-opacity whitespace-nowrap', isCollapsed && 'opacity-0 w-0 h-0 hidden')}>Campo 7</span>
            </Link>
             <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className={cn('ml-auto shrink-0 hover:bg-accent', isCollapsed ? 'hidden' : 'flex')}>
                <PanelLeft className="h-5 w-5" />
            </Button>
        </div>
        <nav className="flex-1 space-y-1 p-2">
            {navItems.map((item) =>
                item.subItems ? (
                <Collapsible key={item.label} defaultOpen={isParentActive(item.href)} className="space-y-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <CollapsibleTrigger className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary-foreground hover:bg-accent w-full data-[state=open]:bg-accent data-[state=open]:text-primary-foreground", isParentActive(item.href) && "bg-accent text-primary-foreground", isCollapsed && 'justify-center')}>
                                <item.icon className="h-5 w-5 shrink-0" />
                                <span className={cn('truncate', isCollapsed && 'hidden')}>{item.label}</span>
                                <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 transition-transform data-[state=open]:rotate-180', isCollapsed && 'hidden')} />
                            </CollapsibleTrigger>
                        </TooltipTrigger>
                        {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                    </Tooltip>
                    <CollapsibleContent className={cn("space-y-1", isCollapsed && 'hidden')}>
                    {item.subItems.map((subItem) => (
                        <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={cn('flex items-center gap-3 rounded-lg py-2 transition-all hover:text-primary-foreground hover:bg-accent', isChildActive(subItem.href) ? 'bg-accent text-primary-foreground' : 'text-muted-foreground', isCollapsed ? 'px-3 justify-center' : 'pl-11 pr-3')}
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
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary-foreground hover:bg-accent',
                        isParentActive(item.href) ? 'bg-accent text-primary-foreground' : 'text-muted-foreground',
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
        <div className="mt-auto p-2 border-t">
          <UserMenu isCollapsed={isCollapsed} />
        </div>
        </aside>
    </TooltipProvider>
  );
};

const UserMenu = ({ isCollapsed }: { isCollapsed: boolean }) => {
    const { profile, logout, user } = useAuth();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cn('w-full hover:bg-accent justify-between', isCollapsed ? 'p-0 h-10' : 'justify-start gap-2 p-2 h-12')}>
                    <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user?.photoURL || ''} alt={profile?.nombre} />
                            <AvatarFallback>{profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                        </Avatar>
                        <div className={cn("flex flex-col items-start", isCollapsed && 'hidden')}>
                            <span className="text-sm font-medium truncate text-card-foreground">{profile?.nombre || 'Usuario'}</span>
                            <span className="text-xs text-muted-foreground">{profile?.rol || 'Rol'}</span>
                        </div>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
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
    )
}

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
            <SheetContent side="left" className="flex flex-col p-0">
               <div className="flex items-center h-16 border-b px-4 shrink-0">
                  <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                      <Avatar className="h-8 w-8">
                          <AvatarImage src={'/logo.png'} alt="Campo 7" />
                          <AvatarFallback>C7</AvatarFallback>
                      </Avatar>
                      <span>Campo 7</span>
                  </Link>
              </div>
              <NavContent />
              <div className="mt-auto p-4 border-t">
                  <UserMenu isCollapsed={false} />
              </div>
            </SheetContent>
          </Sheet>
        </header>
    )
}


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
