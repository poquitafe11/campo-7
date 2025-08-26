
"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tractor,
  ShieldCheck,
  Droplets,
  ClipboardCheck,
  Bug,
  Lightbulb,
  PieChart,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState, useEffect } from "react";
import FeaturePermissionsDialog from "@/components/FeaturePermissionsDialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";

const allFeatures = [
  {
    title: "Producción",
    href: "/production",
    icon: <Tractor className="h-10 w-10 text-primary" />,
  },
  {
    title: "Sanidad",
    href: "/health",
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
  },
  {
    title: "Riego",
    href: "/irrigation",
    icon: <Droplets className="h-10 w-10 text-primary" />,
  },
  {
    title: "C. Calidad",
    href: "/quality-control",
    icon: <ClipboardCheck className="h-10 w-10 text-primary" />,
  },
  {
    title: "C. Biologico",
    href: "/biological-control",
    icon: <Bug className="h-10 w-10 text-primary" />,
  },
  {
    title: "Consultas",
    href: "/queries",
    icon: <Lightbulb className="h-10 w-10 text-primary" />,
  },
  {
    title: "Resumen",
    href: "/summary",
    icon: <PieChart className="h-10 w-10 text-primary" />,
  },
];

type Feature = (typeof allFeatures)[0];

export default function DashboardPage() {
    const { profile } = useAuth();
    const [isPermissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
    const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

    const handlePermissionSettings = (e: React.MouseEvent, feature: Feature) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedFeature(feature);
        setPermissionsDialogOpen(true);
    }
    
    const visibleFeatures = useMemo(() => {
        if (!profile) return [];
        if (profile.rol === 'Admin') {
            return allFeatures;
        }
        if (!profile.permissions) {
            return [];
        }
        return allFeatures.filter(feature => profile.permissions![feature.href]);
    }, [profile]);

    return (
        <div className="flex flex-col h-full">
            <PageHeader title="Áreas de Gestión" />
            <main className="flex-grow">
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {visibleFeatures.map((link) => (
                        <Link href={link.href} key={link.title} className="block group relative">
                            <Card className="h-32 sm:h-36 transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1 hover:border-primary/30">
                                {profile?.rol === 'Admin' && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="absolute top-1 right-1 h-7 w-7 z-10"
                                        onClick={(e) => handlePermissionSettings(e, link)}
                                    >
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                )}
                                <CardContent className="flex flex-col items-center justify-center h-full gap-2 p-4">
                                    {link.icon}
                                    <span className="text-sm font-medium text-center text-foreground">{link.title}</span>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </main>
             {selectedFeature && (
                <FeaturePermissionsDialog
                    isOpen={isPermissionsDialogOpen}
                    onOpenChange={setPermissionsDialogOpen}
                    feature={selectedFeature}
                    onSuccess={() => setPermissionsDialogOpen(false)}
                />
            )}
        </div>
    )
}
