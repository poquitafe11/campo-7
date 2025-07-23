
"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Download } from 'lucide-react';
import { SidebarNav } from './SidebarNav';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ConnectionStatus from './ConnectionStatus';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string,
  }>;
  prompt(): Promise<void>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, logout, user } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) {
      return;
    }
    installPrompt.prompt();
  };

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3 p-2">
             <Avatar className="h-10 w-10">
              <AvatarImage src={user?.photoURL || ''} alt={profile?.nombre} />
              <AvatarFallback>{profile?.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="text-sm font-semibold text-sidebar-foreground truncate">
                    {profile?.nombre || 'Usuario'}
                </span>
                <span className="text-xs text-sidebar-foreground/70">
                    {profile?.rol || 'Invitado'}
                </span>
            </div>
          </div>
          <ConnectionStatus />
        </SidebarHeader>
        <SidebarContent>
            <SidebarNav />
        </SidebarContent>
        <SidebarFooter>
          {installPrompt && (
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleInstallClick}>
              <Download className="h-4 w-4" />
              <span>Instalar Aplicación</span>
            </Button>
          )}
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
            <LogOut className="h-4 w-4" />
            <span>Cerrar Sesión</span>
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
