"use client";

import { useEffect } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TardeSummaryPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Resumen de Tarde" });
    return () => setActions({});
  }, [setActions]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Resumen del Turno Tarde</CardTitle>
          <CardDescription>
            Visualice los reportes y estadísticas del turno tarde.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Resumen en construcción.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
