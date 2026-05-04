"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };
    
    checkInstalled();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  if (isInstalled) {
    return (
       <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium py-2">
         <Check className="h-4 w-4" />
         <span>Aplicación Instalada</span>
       </div>
    );
  }

  if (!deferredPrompt && !isInstalled) {
    return (
        <div className="text-center p-2 rounded-lg border border-primary/20 bg-primary/5">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">PWA Lista</p>
            <p className="text-xs text-sidebar-foreground/80">
                Usa "Añadir a pantalla de inicio" en el menú de tu navegador para instalar **campo 7**.
            </p>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleInstallClick} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-6 shadow-lg transition-all active:scale-95">
        <Download className="mr-2 h-5 w-5" />
        Instalar Aplicación
      </Button>
       <Button onClick={() => setDeferredPrompt(null)} variant="ghost" size="sm" className="w-full text-muted-foreground hover:bg-transparent">
        <X className="mr-2 h-4 w-4" />
        Ahora no
      </Button>
    </div>
  );
}
