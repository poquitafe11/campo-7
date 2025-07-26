
"use client";

import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";

export default function PresupuestoPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeaderWithNav title="Maestro de Presupuesto" />
      <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed bg-muted/50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground">
            Página en Construcción
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta sección se reconstruirá según tus indicaciones.
          </p>
        </div>
      </div>
    </div>
  );
}
