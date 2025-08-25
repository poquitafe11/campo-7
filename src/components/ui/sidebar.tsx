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
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

export function Sidebar() {
  const { profile, user, logout } = useAuth();
  const { actions } = useHeaderActions();
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

      <div className={cn("mt-auto p-4 border-t border-sidebar-accent/20 space-y-4")}>
        <ConnectionStatus />
        <Button onClick={logout} variant="ghost" className="w-full justify-start text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/20">
          <LogOut />
          <span className="ml-2">Cerrar Sesión</span>
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
     return (
       <header className="sticky top-0 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 z-40">
        <div className="flex items-center gap-2">
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
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
        <div className="flex items-center justify-end min-w-[40px]">
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
      "hidden sm:fixed sm:inset-y-0 sm:left-0 sm:z-10 sm:flex sm:flex-col w-64"
    )}>
        {sidebarContent}
    </aside>
  );
}
