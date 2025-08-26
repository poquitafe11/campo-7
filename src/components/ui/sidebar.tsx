"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import ConnectionStatus from "../ConnectionStatus";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";
import { useIsMobile } from "@/hooks/use-mobile";

function SidebarContent({ isExpanded, toggleSidebar }: { isExpanded: boolean, toggleSidebar: () => void }) {
  const { profile, user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-accent/20 flex items-center gap-3 h-[73px]">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-sidebar-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-foreground flex-shrink-0">
          <Menu className="h-5 w-5" />
        </Button>
        {isExpanded && (
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar className="h-10 w-10 border-2 border-sidebar-accent flex-shrink-0">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground font-bold">
                {profile?.nombre.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm truncate">{profile?.nombre}</p>
              <p className="text-xs text-sidebar-muted-foreground truncate">Rol: {profile?.rol}</p>
            </div>
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
}

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { actions } = useHeaderActions();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      setIsExpanded(false);
    }
  }, [isMobile]);

  const toggleSidebar = () => setIsExpanded(!isExpanded);

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
          "fixed top-0 left-0 h-full z-40 transition-width duration-300 ease-in-out",
          isExpanded ? "w-64" : "w-0 md:w-20" // On mobile collapsed is 0 width, on desktop 20
        )}>
           { (isMobile && isExpanded) || !isMobile ? <SidebarContent isExpanded={isExpanded} toggleSidebar={toggleSidebar}/> : null}
        </aside>

        {isMobile && isExpanded && <div className="fixed inset-0 bg-black/60 z-30" onClick={toggleSidebar}></div>}
    </>
  );
}
