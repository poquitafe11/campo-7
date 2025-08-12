
"use client";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, ChevronRight, UserCircle } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import ConnectionStatus from "../ConnectionStatus";

export function Sidebar() {
  const { profile, user, logout } = useAuth();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-accent/20">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-sidebar-accent">
            <AvatarImage src={user?.photoURL || ""} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground font-bold">
              {profile?.nombre.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm">{profile?.nombre}</p>
            <p className="text-xs text-sidebar-muted-foreground">Rol: {profile?.rol}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
      <div className="mt-auto p-4 border-t border-sidebar-accent/20 space-y-4">
        <ConnectionStatus />
        <Button onClick={logout} variant="ghost" className="w-full justify-start text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/20">
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="sm:hidden sticky top-0 flex h-14 items-center gap-4 border-b bg-background px-4 z-40">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs p-0">
            <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
        <div className="flex-1 text-center font-semibold text-lg">
          {profile?.nombre}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden sm:fixed sm:inset-y-0 sm:left-0 sm:z-10 sm:w-64 sm:flex sm:flex-col">
          {sidebarContent}
      </aside>
    </>
  );
}
