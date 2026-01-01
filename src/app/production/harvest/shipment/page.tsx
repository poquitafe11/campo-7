"use client";

import { useEffect } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ShipmentPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Gestión de Embarque" });
    return () => setActions({});
  }, [setActions]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Módulo de Embarque</CardTitle>
          <CardDescription>
            Este módulo para gestionar los embarques está en construcción.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Próximamente.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
