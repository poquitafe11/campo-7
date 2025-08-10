
"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, Database, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import FeaturePermissionsDialog from "@/components/FeaturePermissionsDialog";

const allAttendanceFeatures = [
  {
    icon: <UserCheck className="h-8 w-8 text-primary" />,
    title: "Registro de Asistencia",
    description: "Registra la asistencia diaria del personal.",
    href: "/production/attendance/daily-entry",
  },
  {
    icon: <Database className="h-8 w-8 text-primary" />,
    title: "Base de Asistencia",
    description: "Consulta el historial completo de asistencia.",
    href: "/production/attendance/database",
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    title: "Resumen de Asistencia",
    description: "Visualiza reportes y estadísticas de asistencia.",
    href: "/production/attendance/summary",
  },
];

type Feature = (typeof allAttendanceFeatures)[0];

export default function AttendancePage() {
  const { profile } = useAuth();
  const [isPermissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  const handlePermissionSettings = (e: React.MouseEvent, feature: Feature) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFeature(feature);
    setPermissionsDialogOpen(true);
  };

  const visibleFeatures = useMemo(() => {
    if (!profile) return [];
    if (profile.rol === 'Admin') {
      return allAttendanceFeatures;
    }
    if (!profile.permissions) {
      return [];
    }
    return allAttendanceFeatures.filter(feature => profile.permissions![feature.href]);
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
