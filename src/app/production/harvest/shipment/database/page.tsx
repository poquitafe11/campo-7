"use client";

import { useEffect } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ShipmentDatabasePage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Base de Datos de Embarques" });
    return () => setActions({});
  }, [setActions]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Historial de Embarques</CardTitle>
          <CardDescription>
            Consulte todos los registros de embarques guardados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Base de datos en construcción.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
