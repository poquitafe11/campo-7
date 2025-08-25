"use client";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, LayoutGrid } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import ConnectionStatus from "../ConnectionStatus";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function Sidebar({ isExpanded, onToggle }: SidebarProps) {
  const { profile, user, logout } = useAuth();
  const { actions } = useHeaderActions();
  const router = useRouter();
  const isMobile = useIsMobile();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className={cn("p-4 border-b border-sidebar-accent/20 flex items-center h-[73px]", isExpanded || isMobile ? "justify-between" : "justify-center")}>
        <div className={cn("flex items-center gap-3", !(isExpanded || isMobile) && "hidden")}>
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
        <SidebarNav isExpanded={isExpanded || isMobile} />
      </div>

      <div className={cn("mt-auto p-4 border-t border-sidebar-accent/20 space-y-4", !(isExpanded || isMobile) && "px-2")}>
        <ConnectionStatus />
        <Button onClick={logout} variant="ghost" className={cn("w-full justify-start text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/20", !(isExpanded || isMobile) && "justify-center")}>
          <LogOut />
          {(isExpanded || isMobile) && <span className="ml-2">Cerrar Sesión</span>}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
     return (
       <header className="sticky top-0 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 z-40">
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs p-0 w-64 bg-sidebar border-r-0">
              <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
              {sidebarContent}
            </SheetContent>
          </Sheet>
           {actions?.left}
        </div>
        <div className="flex-1 text-center font-semibold text-lg truncate px-2">
          {actions?.title ?? ''}
        </div>
        <div className="flex items-center justify-end">
            {actions?.right ??
             <Link href="/dashboard" passHref>
                <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9">
                    <LayoutGrid className="h-5 w-5" />
                    <span className="sr-only">Dashboard</span>
                </Button>
            </Link>
            }
        </div>
      </header>
     );
  }

  return (
    <aside className={cn(
      "hidden sm:fixed sm:inset-y-0 sm:left-0 sm:z-10 sm:flex sm:flex-col transition-[width] duration-300 ease-in-out",
      isExpanded ? "w-64" : "w-14"
    )}>
        <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
            <div className={cn("p-4 border-b border-sidebar-accent/20 flex items-center h-[73px]", isExpanded ? "justify-between" : "justify-center")}>
                {isExpanded && (
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
                )}
                 <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 text-sidebar-muted-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-foreground">
                    <Menu />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <SidebarNav isExpanded={isExpanded} />
            </div>
            <div className={cn("mt-auto p-4 border-t border-sidebar-accent/20 space-y-4", !isExpanded && "px-2")}>
                <ConnectionStatus />
                <Button onClick={logout} variant="ghost" className={cn("w-full justify-start text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/20", !isExpanded && "justify-center")}>
                    <LogOut />
                    {isExpanded && <span className="ml-2">Cerrar Sesión</span>}
                </Button>
            </div>
        </div>
    </aside>
  );
}
