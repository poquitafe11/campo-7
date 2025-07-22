
"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";
import { FilePlus2, Database, BarChart3 } from "lucide-react";

const activityFeatures = [
  {
    icon: <FilePlus2 className="h-8 w-8 text-primary" />,
    title: "Crear Registro",
    description: "Genera una nueva ficha de registro de actividad.",
    href: "/production/activities/create",
  },
  {
    icon: <Database className="h-8 w-8 text-primary" />,
    title: "Base de Registro",
    description: "Consulta el historial completo de actividades.",
    href: "#", // Placeholder link
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    title: "Resumen de Actividades",
    description: "Visualiza reportes y estadísticas de las actividades.",
    href: "#", // Placeholder link
  },
];

export default function ProductionActivitiesPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeaderWithNav title="Registro de Actividades" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activityFeatures.map((feature) => (
          <Link href={feature.href} key={feature.title} className="block group">
            <Card className="h-full transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1 hover:border-primary/50">
              <CardHeader>
                <div className="mb-3">{feature.icon}</div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="pt-1">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
