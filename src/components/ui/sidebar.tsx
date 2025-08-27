"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import ConnectionStatus from "../ConnectionStatus";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Sidebar({ isExpanded, setIsExpanded }: SidebarProps) {
  const { actions } = useHeaderActions();
  const { profile, user, logout } = useAuth();
  const isMobile = useIsMobile();

  const toggleSidebar = () => setIsExpanded(!isExpanded);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
        <div className="p-4 border-b border-sidebar-accent/20 flex items-center gap-3 h-[73px] flex-shrink-0">
          <Avatar className="h-10 w-10 border-2 border-sidebar-accent flex-shrink-0">
            <AvatarImage src={user?.photoURL || ""} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground font-bold">
              {profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          {isExpanded && (
            <div className="overflow-hidden">
              <p className="font-semibold text-sm truncate">{profile?.nombre}</p>
              <p className="text-xs text-sidebar-muted-foreground truncate">Rol: {profile?.rol}</p>
            </div>
          )}
        </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav isExpanded={isExpanded} />
      </div>

      <div className="mt-auto p-2 border-t border-sidebar-accent/20">
        <ConnectionStatus isExpanded={isExpanded} />
        <Button
            variant="ghost"
            onClick={logout}
            className="w-full flex items-center justify-start gap-3 mt-1 text-sidebar-muted-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-foreground p-2"
        >
            <LogOut className="h-5 w-5 flex-shrink-0"/>
            {isExpanded && <span className="truncate">Cerrar Sesión</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <>
        {/* Mobile Header */}
        <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between p-2 h-[73px] bg-background border-b md:hidden">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <Menu className="h-6 w-6" />
            </Button>
            <div className="text-center font-semibold text-lg">
                {actions.title}
            </div>
            <div className="flex items-center gap-2">
                {actions.right || <div className="w-10 h-10"></div>}
            </div>
        </header>

        {/* Sidebar */}
        <aside className={cn(
          "fixed top-0 left-0 h-full z-40 transition-transform md:transition-width duration-300 ease-in-out",
          isExpanded ? "w-64 translate-x-0" : "-translate-x-full md:translate-x-0 md:w-20"
        )}>
            {sidebarContent}
        </aside>

        {isMobile && isExpanded && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={toggleSidebar}></div>}
    </>
  );
}
