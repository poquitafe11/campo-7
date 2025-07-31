
"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeCheck, Ruler } from "lucide-react";

const features = [
  {
    icon: <BadgeCheck className="h-8 w-8 text-primary" />,
    title: "Registro de Calidad",
    description: "Registra los parámetros de calidad como Brix y firmeza.",
    href: "/quality-control/register",
  },
  {
    icon: <Ruler className="h-8 w-8 text-primary" />,
    title: "Evaluaciones",
    description: "Mide el calibre de bayas utilizando la cámara.",
    href: "/quality-control/evaluations",
  },
];

export default function QualityControlPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((feature) => (
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
