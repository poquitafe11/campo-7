
"use client";

import { useEffect } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterHarvestPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Registro de Cosecha" });
    return () => setActions({});
  }, [setActions]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Formulario de Registro de Cosecha</CardTitle>
          <CardDescription>
            Ingrese los datos de la cosecha diaria.
          </CardDescription>
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
