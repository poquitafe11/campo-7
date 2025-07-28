"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilePlus2, ClipboardList, Database } from "lucide-react";

const dailyReportFeatures = [
  {
    icon: <FilePlus2 className="h-8 w-8 text-primary" />,
    title: "Crear Parte Diario",
    description: "Genera un nuevo parte diario de labores y novedades.",
    href: "/production/daily-report/create",
  },
  {
    icon: <ClipboardList className="h-8 w-8 text-primary" />,
    title: "Resumen del Día",
    description: "Visualiza un resumen consolidado de los partes del día.",
    href: "#", // Placeholder link
  },
  {
    icon: <Database className="h-8 w-8 text-primary" />,
    title: "Base de Partes Diario",
    description: "Accede al historial completo de todos los partes diarios.",
    href: "#", // Placeholder link
  },
];

export default function DailyReportPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {dailyReportFeatures.map((feature) => (
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
  );
}
