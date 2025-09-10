
"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, ArrowLeft, LayoutGrid } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import ConnectionStatus from "../ConnectionStatus";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "./sheet";

function SidebarContent() {
  const { profile, user, logout } = useAuth();
  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-accent/20 flex items-center gap-3 h-[73px] flex-shrink-0">
        <Avatar className="h-10 w-10 border-2 border-sidebar-accent flex-shrink-0">
          <AvatarImage src={user?.photoURL || ""} />
          <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground font-bold">
            {profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="overflow-hidden">
          <p className="font-semibold text-sm truncate">{profile?.nombre}</p>
          <p className="text-xs text-sidebar-muted-foreground truncate">Rol: {profile?.rol}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav isExpanded={true} />
      </div>

      <div className="mt-auto p-2 border-t border-sidebar-accent/20">
        <ConnectionStatus isExpanded={true} />
        <Button
            variant="ghost"
            onClick={logout}
            className="w-full flex items-center justify-start gap-3 mt-1 text-sidebar-muted-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-foreground p-2"
        >
            <LogOut className="h-5 w-5 flex-shrink-0"/>
            <span className="truncate">Cerrar Sesión</span>
        </Button>
      </div>
    </div>
  );
}


function Header() {
  const { actions } = useHeaderActions();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderTitle = () => {
    if (typeof actions.title === 'string') {
      return <h1 className="text-lg font-bold truncate">{actions.title}</h1>;
    }
    return actions.title;
  };

  return (
    <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between p-2 h-16 bg-background border-b">
        <div className="flex items-center gap-1 flex-shrink-0">
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 flex justify-center items-center text-center px-2">
          {renderTitle()}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {actions.right}
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
            <LayoutGrid className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <SheetContent side="left" className="p-0 w-64">
        <SidebarContent />
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar() {
  return <Header />;
}
