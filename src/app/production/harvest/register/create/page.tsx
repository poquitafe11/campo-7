"use client";

import { useEffect } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CreateHarvestRegisterPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Crear Registro de Cosecha" });
    return () => setActions({});
  }, [setActions]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Formulario de Registro de Cosecha</CardTitle>
          <CardDescription>Complete los campos para registrar una nueva entrada de cosecha.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Formulario en construcción.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
