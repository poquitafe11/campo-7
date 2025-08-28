"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, ArrowLeft, LayoutGrid } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import ConnectionStatus from "../ConnectionStatus";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "next/navigation";

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Sidebar({ isExpanded, setIsExpanded }: SidebarProps) {
  const { actions } = useHeaderActions();
  const { profile, user, logout } = useAuth();
  const isMobile = useIsMobile();
  const router = useRouter();

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
  
  const MobileHeader = () => (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between p-2 h-16 bg-background border-b">
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <Menu className="h-6 w-6" />
            </Button>
             <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-center font-semibold text-lg">
             {actions.title}
        </div>
        
        <div className="flex items-center gap-1">
            {actions.right}
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                <LayoutGrid className="h-5 w-5" />
            </Button>
        </div>
    </header>
  );

  const DesktopSidebar = () => (
     <aside className={cn(
        "hidden md:block fixed top-0 left-0 h-full z-20 transition-width duration-300 ease-in-out",
        isExpanded ? "w-64" : "w-20"
      )}>
        <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
            <div className="p-4 border-b border-sidebar-accent/20 flex items-center justify-between h-[73px] flex-shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
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
                 <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/20">
                    <Menu className="h-6 w-6" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <SidebarNav isExpanded={isExpanded} />
            </div>

            <div className="mt-auto p-2 border-t border-sidebar-accent/20">
                <ConnectionStatus isExpanded={isExpanded} />
                <Button variant="ghost" onClick={logout} className="w-full flex items-center gap-3 mt-1 text-sidebar-muted-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-foreground p-2 justify-start">
                    <LogOut className="h-5 w-5 flex-shrink-0"/>
                    {isExpanded && <span className="truncate">Cerrar Sesión</span>}
                </Button>
            </div>
        </div>
      </aside>
  );


  return (
    <>
      {isMobile ? <MobileHeader /> : <DesktopSidebar />}
      
      {isMobile && isExpanded && (
        <>
          <aside className="fixed top-0 left-0 h-full z-40 w-64 transition-transform duration-300 ease-in-out translate-x-0">
              {sidebarContent}
          </aside>
          <div className="fixed inset-0 bg-black/60 z-30" onClick={toggleSidebar}></div>
        </>
      )}
    </>
  );
}