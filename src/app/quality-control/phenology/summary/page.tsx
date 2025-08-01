
"use client";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PhenologySummaryPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Resumen Fenológico" />
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
