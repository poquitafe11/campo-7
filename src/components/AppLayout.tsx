
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

const navItems = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/maestros', icon: Layers, label: 'Maestros' },
  { href: '/production', icon: Tractor, label: 'Producción' },
  { href: '/users', icon: Users, label: 'Usuarios' },
];

const Sidebar = () => {
  const pathname = usePathname();
  const { profile, logout, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  const isParentActive = (item: (typeof navItems)[number]) => {
     if (!item.href) return false;
     if (item.href === '/dashboard') return pathname === item.href;
     return pathname.startsWith(item.href);
  };

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r transition-all duration-300 ease-in-out bg-sidebar text-sidebar-foreground',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex items-center h-16 border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sidebar-primary-foreground">
           <Avatar className={cn('h-8 w-8 transition-all', isCollapsed ? 'h-8 w-8' : 'h-8 w-8')}>
              <AvatarImage src={'/logo.png'} alt="Campo 7" />
              <AvatarFallback>C7</AvatarFallback>
            </Avatar>
          <span className={cn('font-bold transition-opacity', isCollapsed && 'opacity-0 w-0')}>Campo 7</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-2 p-2">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-sidebar-primary-foreground hover:bg-sidebar-accent',
              isParentActive(item) && 'bg-sidebar-accent text-sidebar-primary-foreground',
              isCollapsed && 'justify-center'
            )}
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
            <span className={cn(isCollapsed && 'hidden')}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto p-2 border-t border-sidebar-border">
        <div className="flex items-center w-full">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn('w-full hover:bg-sidebar-accent', isCollapsed ? 'justify-center p-2 h-12' : 'justify-start gap-2 p-2 h-12')}>
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user?.photoURL || ''} alt={profile?.nombre} />
                            <AvatarFallback>{profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                        </Avatar>
                        <div className={cn("flex flex-col items-start", isCollapsed && 'hidden')}>
                            <span className="text-sm font-medium truncate text-sidebar-foreground">{profile?.nombre || 'Usuario'}</span>
                            <span className="text-xs text-muted-foreground">{profile?.rol || 'Rol'}</span>
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
            <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="ml-auto hidden md:flex shrink-0 hover:bg-sidebar-accent">
                <PanelLeft className="h-5 w-5" />
            </Button>
        </div>
      </div>
    </aside>
  );
};

const MobileBottomNav = () => {
  const pathname = usePathname();
  const { logout, profile } = useAuth();
  const router = useRouter();

  const handleNavigation = (href: string) => {
    router.push(href);
  };
  
  const isParentActive = (item: (typeof navItems)[number]) => {
     if (!item.href) return false;
     if (item.href === '/dashboard') return pathname === item.href;
     return pathname.startsWith(item.href);
  };

  return (
    <footer className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm">
      <nav className="grid grid-cols-5 items-center justify-items-center h-16">
        {navItems.map((item) => (
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
      <div className="flex flex-col flex-1">
        <main className={cn('flex-1 p-4 sm:p-6', isMobile && 'pb-24')}>
           {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
