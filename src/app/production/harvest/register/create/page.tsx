"use client";

import { useEffect } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';

// This is now a placeholder as the main form was moved to the shipment section.
// The user might want a different form here later.
export default function CreateHarvestRegisterPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Crear Registro de Cosecha" });
    return () => setActions({});
  }, [setActions]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-background">
            <h3 className="text-xl font-semibold text-muted-foreground">Página en Blanco</h3>
            <p className="text-muted-foreground mt-2">
                El formulario de registro de cosecha se encuentra en la sección de embarque.
            </p>
        </div>
    </div>
  );
}
