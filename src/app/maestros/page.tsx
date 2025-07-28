
"use client";

import { FeatureCard } from "@/components/FeatureCard";
import { PageHeader } from "@/components/PageHeader";
import { Layers, Box, Users, Thermometer, Ruler, ScrollText } from "lucide-react";

const masterFeatures = [
  {
    icon: <Box className="h-8 w-8" />,
    title: "Lotes",
    description: "Gestiona los lotes y cuarteles de tu campo.",
    href: "/maestro-lotes",
  },
  {
    icon: <Layers className="h-8 w-8" />,
    title: "Labores",
    description: "Administra las diferentes labores del campo.",
    href: "/maestro-labores",
  },
  {
    icon: <Users className="h-8 w-8" />,
    title: "Asistentes",
    description: "Gestiona la lista de asistentes y encargados.",
    href: "/asistentes",
  },
  {
    icon: <Thermometer className="h-8 w-8" />,
    title: "Mínimos y Máximos",
    description: "Establece los rangos de tolerancia para las labores.",
    href: "/min-max",
  },
  {
    icon: <ScrollText className="h-8 w-8" />,
    title: "Presupuesto",
    description: "Configura el presupuesto para las labores.",
    href: "/presupuesto",
  },
];

export default function MaestrosPage() {
  return (
    <>
      <PageHeader title="Datos Maestros" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {masterFeatures.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </>
  );
}
