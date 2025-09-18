
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { RotateCw, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function OrientationLocker() {
  const [isLocked, setIsLocked] = useState(false);
  const [isApiSupported, setIsApiSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if the Screen Orientation API and its lock method are supported.
    const supported = 'screen' in window && 
                      'orientation' in window.screen && 
                      'lock' in window.screen.orientation;
    setIsApiSupported(supported);
  }, []);

  const lockOrientation = async () => {
    try {
      await window.screen.orientation.lock('landscape');
      setIsLocked(true);
      toast({ title: 'Orientación bloqueada', description: 'La pantalla se ha fijado en modo horizontal.' });
    } catch (err: any) {
      console.error("Failed to lock orientation:", err);
      // Even with the check, some sandboxed environments might still throw an error.
      // We handle it gracefully.
      toast({
        variant: 'destructive',
        title: 'No se pudo bloquear la orientación',
        description: 'Tu dispositivo o navegador denegó el permiso en este momento.'
      });
    }
  };

  const unlockOrientation = () => {
    window.screen.orientation.unlock();
    setIsLocked(false);
    toast({ title: 'Orientación desbloqueada', description: 'La pantalla ahora puede girar libremente.' });
  };

  const handleToggleLock = () => {
    if (isLocked) {
      unlockOrientation();
    } else {
      lockOrientation();
    }
  };

  // If the API is not supported at all, render nothing.
  if (!isApiSupported) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        size="icon"
        onClick={handleToggleLock}
        className="rounded-full w-14 h-14 shadow-lg bg-primary/90 hover:bg-primary text-primary-foreground"
        aria-label={isLocked ? 'Desbloquear orientación' : 'Bloquear en horizontal'}
      >
        {isLocked ? (
          <Smartphone className="h-6 w-6" />
        ) : (
          <RotateCw className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
}
