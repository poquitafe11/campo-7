
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";
import { useEffect } from "react";

export default function PhenologySummaryPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Resumen Fenológico" });
    return () => setActions({});
  }, [setActions]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Resumen y Gráficos</CardTitle>
          <CardDescription>
            Aquí se mostrarán los gráficos y proyecciones fenológicas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Contenido en construcción.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
