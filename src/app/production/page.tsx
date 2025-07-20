"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { ClipboardList, BarChart3, Users, BookUser } from "lucide-react";

const productionFeatures = [
  {
    icon: <ClipboardList className="h-8 w-8 text-primary" />,
    title: "Parte Diario",
    description: "Registra el parte diario de actividades y novedades.",
    href: "/production/daily-report",
  },
  {
    icon: <BookUser className="h-8 w-8 text-primary" />,
    title: "Registro de Actividades",
    description: "Mantén un historial detallado de las tareas realizadas.",
    href: "#", // Placeholder link
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    title: "Análisis y Reportes",
    description: "Visualiza datos y genera informes de producción.",
    href: "#", // Placeholder link
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Asistencia de Personal",
    description: "Gestiona la asistencia y el rendimiento del equipo.",
    href: "/production/attendance",
  },
];

export default function ProductionPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Producción" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {productionFeatures.map((feature) => (
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
