
"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilePlus2, Database, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import FeaturePermissionsDialog from "@/components/FeaturePermissionsDialog";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

const allActivityFeatures = [
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
    href: "/production/activities/database",
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    title: "Resumen de Actividades",
    description: "Visualiza reportes y estadísticas de las actividades.",
    href: "/production/activities/summary",
  },
];

type Feature = (typeof allActivityFeatures)[0];

export default function ProductionActivitiesPage() {
  const { profile } = useAuth();
  const { setActions } = useHeaderActions();
  const [isPermissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  useEffect(() => {
    setActions({ title: "Registro de Actividades" });
    return () => setActions({});
  }, [setActions]);

  const handlePermissionSettings = (e: React.MouseEvent, feature: Feature) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFeature(feature);
    setPermissionsDialogOpen(true);
  };

  const visibleFeatures = useMemo(() => {
    if (!profile) return [];
    if (profile.rol === 'Admin') {
      return allActivityFeatures;
    }
    if (!profile.permissions) {
      return [];
    }
    return allActivityFeatures.filter(feature => profile.permissions![feature.href]);
  }, [profile]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleFeatures.map((feature) => (
          <Link href={feature.href} key={feature.title} className="block group relative">
            <Card className="h-full transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1 hover:border-primary/50">
              {profile?.rol === 'Admin' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-7 w-7 z-10"
                  onClick={(e) => handlePermissionSettings(e, feature)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              <CardHeader>
                <div className="mb-3">{feature.icon}</div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="pt-1">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      {selectedFeature && (
        <FeaturePermissionsDialog
          isOpen={isPermissionsDialogOpen}
          onOpenChange={setPermissionsDialogOpen}
          feature={selectedFeature}
          onSuccess={() => setPermissionsDialogOpen(false)}
        />
      )}
    </>
  );
}
