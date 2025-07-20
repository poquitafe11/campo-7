"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { ClipboardList, BarChart3, Users, BookUser } from "lucide-react";

const productionFeatures = [
  {
    icon: <ClipboardList className="h-10 w-10 text-primary" />,
    title: "Parte Diario",
    href: "#", // Placeholder link
  },
  {
    icon: <BookUser className="h-10 w-10 text-primary" />,
    title: "Registro de Actividades",
    href: "#", // Placeholder link
  },
  {
    icon: <BarChart3 className="h-10 w-10 text-primary" />,
    title: "Análisis y Reportes",
    href: "#", // Placeholder link
  },
  {
    icon: <Users className="h-10 w-10 text-primary" />,
    title: "Asistencia de Personal",
    href: "#", // Placeholder link
  },
];

export default function ProductionPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Producción" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {productionFeatures.map((feature) => (
          <Link href={feature.href} key={feature.title} className="block">
            <Card className="aspect-square flex flex-col items-center justify-center p-2 transition-transform hover:scale-105 hover:shadow-lg rounded-xl bg-card">
              <CardContent className="p-0 flex flex-col items-center justify-center gap-2">
                {feature.icon}
                <p className="font-semibold text-center text-card-foreground text-sm">{feature.title}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
