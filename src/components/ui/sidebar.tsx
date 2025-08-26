"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutGrid, Settings, Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import ConnectionStatus from "../ConnectionStatus";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

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

function MobileHeader() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { actions } = useHeaderActions();

  return (
    <header className="sm:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between h-16 px-4 border-b bg-background text-foreground">
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
                 <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
             <SheetContent side="left" className="p-0 w-64 bg-sidebar border-none">
                <SidebarContent isExpanded={true} />
            </SheetContent>
        </Sheet>
        
        <div className="flex-1 text-center">
             <h1 className="text-lg font-semibold tracking-tight">
                {actions.title}
             </h1>
        </div>

        <div className="flex items-center gap-2">
            {actions.right ? actions.right : (
              <Button variant="ghost" size="icon" asChild>
                  <Link href="/dashboard">
                      <LayoutGrid className="h-5 w-5" />
                  </Link>
              </Button>
            )}
        </div>
    </header>
  );
}

function DesktopSidebar({ isExpanded, setIsExpanded }: SidebarProps) {
  return (
    <aside className={cn(
      "hidden sm:fixed sm:inset-y-0 sm:left-0 sm:z-10 sm:flex sm:flex-col transition-[width] duration-300 ease-in-out",
      isExpanded ? "w-64" : "w-20"
    )}>
        <SidebarContent isExpanded={isExpanded} />
         <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-16 -right-5 h-8 w-8 bg-background border rounded-full text-foreground hover:bg-muted"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <Menu className="h-4 w-4" />
        </Button>
    </aside>
  );
}


export function Sidebar({ isExpanded, setIsExpanded }: SidebarProps) {
    const isMobile = useIsMobile();

    if (isMobile) {
        return <MobileHeader />;
    }

    return <DesktopSidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />;
}
