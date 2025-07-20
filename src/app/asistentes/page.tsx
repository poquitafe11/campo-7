
"use client";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function AsistentesPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Configuración de Asistentes" />
      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>
            Esta sección está en desarrollo. Aquí podrás configurar y gestionar tus asistentes de IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground py-16">
            <Construction className="h-16 w-16" />
            <p className="text-lg font-medium">Funcionalidad en construcción</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
