"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { ClipboardList, Users, PenSquare, LineChart } from "lucide-react";

const productionFeatures = [
  {
    icon: <ClipboardList className="h-8 w-8 text-primary" />,
    title: "Parte Diario",
    description: "Registra el parte diario de actividades y novedades.",
    href: "/production/daily-report",
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Asistencia de Personal",
    description: "Gestiona la asistencia y el rendimiento del equipo.",
    href: "/production/attendance",
  },
  {
    icon: <PenSquare className="h-8 w-8 text-primary" />,
    title: "Registro de Actividades",
    description: "Registra actividades específicas en el campo.",
    href: "/production/daily-report/create",
  },
  {
    icon: <LineChart className="h-8 w-8 text-primary" />,
    title: "Análisis y Reportes",
    description: "Visualiza análisis y reportes de producción.",
    href: "#", // Placeholder
  },
];

export default function ProductionPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Producción" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
