
"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, ArrowLeft, LayoutGrid, Wifi, WifiOff } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";
import { useRouter, usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "./sheet";
import { DialogTitle, DialogDescription } from "@radix-ui/react-dialog";
import { goOnline, goOffline, isOffline } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useMasterData } from "@/context/MasterDataContext";


function SidebarContent() {
  const { profile, user, logout } = useAuth();
  const { toast } = useToast();
  const { refreshData } = useMasterData();
  const [isOnlineState, setIsOnlineState] = useState(!isOffline());

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnlineState(!isOffline());
    };
    
    // Set initial state
    updateOnlineStatus();
    
    window.addEventListener('online-status-changed', updateOnlineStatus);
    
    return () => window.removeEventListener('online-status-changed', updateOnlineStatus);
  }, []);

  const handleSync = async () => {
    try {
      await goOnline();
      await refreshData(true); 
      toast({ title: "Sincronización Activada", description: "Los datos se están sincronizando con la nube." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error de Sincronización", description: "No se pudo activar la sincronización." });
    }
  };

  const handleGoOffline = async () => {
    try {
      await goOffline();
      toast({ title: "Modo Offline Activado", description: "La aplicación ahora trabaja sin conexión." });
    } catch (error) {
       toast({ variant: "destructive", title: "Error de Sincronización", description: "No se pudo desactivar la sincronización." });
    }
  };

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
          <div className="flex items-center gap-1.5">
            <span className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                isOnlineState ? "bg-green-500 animate-pulse" : "bg-gray-500"
            )}></span>
            <p className="text-xs text-sidebar-muted-foreground truncate">
                {isOnlineState ? "En Línea" : "Sin Conexión"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarNav isExpanded={true} />
      </div>

      <div className="mt-auto p-2 border-t border-sidebar-accent/20">
        <Button
            variant="ghost"
            onClick={handleSync}
            className="w-full flex items-center justify-start gap-3 mt-1 text-sidebar-muted-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-foreground p-2"
            disabled={isOnlineState}
        >
            <Wifi className="h-5 w-5 flex-shrink-0"/>
            <span className="truncate">Sincronizar</span>
        </Button>
         <Button
            variant="ghost"
            onClick={handleGoOffline}
            className="w-full flex items-center justify-start gap-3 mt-1 text-sidebar-muted-foreground hover:bg-sidebar-accent/20 hover:text-sidebar-foreground p-2"
            disabled={!isOnlineState}
        >
            <WifiOff className="h-5 w-5 flex-shrink-0"/>
            <span className="truncate">Trabajar sin conexión</span>
        </Button>
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
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderTitle = () => {
    if (typeof actions.title === 'string') {
      return <h1 className="text-lg font-bold truncate">{actions.title}</h1>;
    }
    return actions.title;
  };

  const handleBack = () => {
    // Si la página ha definido una ruta de retroceso específica (navegación jerárquica), la usamos.
    if (actions.backUrl) {
      router.push(actions.backUrl);
      return;
    }

    // Si no hay backUrl, calculamos la ruta jerárquica para evitar retroceder 
    // acciones de estado (filtros, popovers, etc.) que se guardan en el historial del navegador.
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 1) {
      // Navegamos al nivel superior de la ruta actual
      const parentPath = '/' + segments.slice(0, -1).join('/');
      router.push(parentPath);
    } else if (pathname !== '/dashboard') {
      // Si estamos en un primer nivel que no es el dashboard, volvemos al inicio
      router.push('/dashboard');
    } else {
      // Comportamiento estándar si ya estamos en la raíz o dashboard
      router.back();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between p-2 h-16 bg-background border-b">
      <div className="flex items-center gap-1">
         <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <DialogTitle className="sr-only">Menú Principal</DialogTitle>
            <DialogDescription className="sr-only">
              Navegación principal de la aplicación, perfil de usuario y estado de la conexión.
            </DialogDescription>
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex justify-center items-center text-center px-2 min-w-0">
          <div className="truncate">
            {renderTitle()}
          </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
          {actions.right ? actions.right : (
             <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                <LayoutGrid className="h-5 w-5" />
             </Button>
          )}
      </div>
    </header>
  );
}

export function Sidebar() {
  return <Header />;
}
