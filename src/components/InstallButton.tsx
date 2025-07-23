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

  if (!deferredPrompt) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleInstallClick} className="w-full">
        <Download className="mr-2 h-4 w-4" />
        Instalar Aplicación
      </Button>
       <Button onClick={() => setDeferredPrompt(null)} variant="ghost" size="sm" className="w-full text-muted-foreground">
        <X className="mr-2 h-4 w-4" />
        Ahora no
      </Button>
    </div>
  );
}
