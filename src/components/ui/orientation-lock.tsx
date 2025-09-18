
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { RotateCw, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function OrientationLocker() {
  const [isLocked, setIsLocked] = useState(false);
  const { toast } = useToast();

  const lockOrientation = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      // Use the new Screen Orientation API
      await window.screen.orientation.lock('landscape');
      setIsLocked(true);
      toast({ title: 'Orientación bloqueada', description: 'La pantalla se ha fijado en modo horizontal.' });
    } catch (err: any) {
      console.error("Failed to lock orientation:", err);
      // Fallback for older browsers or if locking fails
      if (err.name === 'NotSupportedError') {
        toast({
          variant: 'destructive',
          title: 'Función no soportada',
          description: 'Tu navegador no soporta el bloqueo de orientación.'
        });
      } else {
         toast({
          variant: 'destructive',
          title: 'Error al girar',
          description: 'No se pudo bloquear la orientación de la pantalla.'
        });
      }
    }
  };

  const unlockOrientation = () => {
    window.screen.orientation.unlock();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
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

  // Check if the API is available
  const isApiSupported = typeof window !== 'undefined' && 'screen' in window && 'orientation' in window.screen;

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
