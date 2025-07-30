
"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, BarChart3 } from "lucide-react";

const irrigationFeatures = [
  {
    icon: <Database className="h-8 w-8 text-primary" />,
    title: "Registro y Base",
    description: "Digitaliza y gestiona los registros de riego.",
    href: "/irrigation/register",
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    title: "Resumen de Riego",
    description: "Visualiza reportes y estadísticas de riego.",
    href: "/irrigation/summary",
  },
];

export default function IrrigationPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {irrigationFeatures.map((feature) => (
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
