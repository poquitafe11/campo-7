
"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeCheck, Ruler, Leaf } from "lucide-react";
import { useEffect } from "react";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

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
  {
    icon: <Leaf className="h-8 w-8 text-primary" />,
    title: "Fenología",
    description: "Registra y monitorea las etapas fenológicas del cultivo.",
    href: "/quality-control/phenology",
  }
];

export default function QualityControlPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions(<>Control de Calidad</>);
    return () => setActions(null);
  }, [setActions]);

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
