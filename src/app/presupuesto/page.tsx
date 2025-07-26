"use client";

import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";

export default function PresupuestoPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeaderWithNav title="Presupuesto" />
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/50">
        <h3 className="text-xl font-semibold text-muted-foreground">Página en Construcción</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          La funcionalidad de presupuesto se implementará aquí.
        </p>
      </div>
    </div>
  );
}
