"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutGrid, Users, Map, Settings } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import ConnectionStatus from "../ConnectionStatus";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname } from "next/navigation";


const BottomNavbar = () => {
    const { logout } = useAuth();
    const pathname = usePathname();
    const isActive = (href: string) => pathname === href;

    const navItems = [
        { href: '/dashboard', label: 'Áreas', icon: LayoutGrid },
        { href: '/users', label: 'Usuarios', icon: Users },
        { href: '/maps', label: 'Mapas', icon: Map },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 sm:hidden">
            <div className="flex justify-around items-center h-16">
                {navItems.map(item => (
                     <Link href={item.href} key={item.href} className={cn(
                        "flex flex-col items-center justify-center gap-1 w-full h-full",
                        isActive(item.href) ? "text-primary" : "text-muted-foreground"
                     )}>
                        <item.icon className="h-5 w-5" />
                        <span className="text-xs">{item.label}</span>
                    </Link>
                ))}
                <button onClick={logout} className="flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground">
                    <LogOut className="h-5 w-5" />
                    <span className="text-xs">Salir</span>
                </button>
            </div>
        </nav>
    )
}


export function Sidebar() {
  const { profile, user } = useAuth();
  const isMobile = useIsMobile();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className={cn("p-4 border-b border-sidebar-accent/20 flex items-center h-[73px] justify-between")}>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-sidebar-accent">
            <AvatarImage src={user?.photoURL || ""} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground font-bold">
              {profile?.nombre.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm whitespace-nowrap">{profile?.nombre}</p>
            <p className="text-xs text-sidebar-muted-foreground whitespace-nowrap">Rol: {profile?.rol}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav isExpanded={true} />
      </div>

      <div className={cn("mt-auto p-4 border-t border-sidebar-accent/20")}>
        <ConnectionStatus />
      </div>
    </div>
  );

  if (isMobile) {
     return <BottomNavbar />;
  }

  return (
    <aside className={cn(
      "hidden sm:fixed sm:inset-y-0 sm:left-0 sm:z-10 sm:flex sm:flex-col w-64"
    )}>
        {sidebarContent}
    </aside>
  );
}
