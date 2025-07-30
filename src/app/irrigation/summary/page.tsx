
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";

export default function IrrigationSummaryPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Resumen de Riego" />
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Riego</CardTitle>
          <CardDescription>
            Aquí se mostrarán los gráficos y estadísticas de riego.
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
