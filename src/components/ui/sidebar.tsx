"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import ConnectionStatus from "../ConnectionStatus";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

function SidebarContent({ isExpanded }: { isExpanded: boolean }) {
  const { profile, user, logout } = useAuth();
  
  return (
     <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className={cn("p-4 border-b border-sidebar-accent/20 flex items-center h-[73px] justify-between")}>
          <div className={cn("flex items-center gap-3", !isExpanded && "w-full justify-center")}>
            <Avatar className={cn("h-10 w-10 border-2 border-sidebar-accent", !isExpanded && "h-9 w-9")}>
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground font-bold">
                {profile?.nombre.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isExpanded && (
                <div>
                  <p className="font-semibold text-sm whitespace-nowrap">{profile?.nombre}</p>
                  <p className="text-xs text-sidebar-muted-foreground whitespace-nowrap">Rol: {profile?.rol}</p>
                </div>
            )}
          </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav isExpanded={isExpanded} />
      </div>

      <div className={cn("mt-auto p-4 border-t border-sidebar-accent/20")}>
         <ConnectionStatus isExpanded={isExpanded} />
         <Button variant="ghost" onClick={logout} className="w-full justify-start gap-3 mt-2 text-sidebar-muted-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-foreground">
            <LogOut className="h-4 w-4"/>
            {isExpanded && "Cerrar Sesión"}
         </Button>
      </div>
    </div>
  )
}

export function Sidebar({ isExpanded, setIsExpanded }: SidebarProps) {
    const isMobile = useIsMobile();

    return (
        <aside className={cn(
          "fixed inset-y-0 left-0 z-10 flex flex-col transition-[width] duration-300 ease-in-out",
          isExpanded ? "w-64" : "w-20"
        )}>
            <SidebarContent isExpanded={isExpanded} />
            {!isMobile && (
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-16 -right-5 h-8 w-8 bg-background border rounded-full text-foreground hover:bg-muted"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <Menu className="h-4 w-4" />
                </Button>
            )}
        </aside>
    );
}
