
"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import {
  Tractor,
  ShieldCheck,
  Droplets,
  ClipboardCheck,
  Bug,
  Lightbulb,
  PieChart,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const mainFeatures = [
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


function FinalSolutionCard() {
    const projectId = 'brujos';
    const aphaApiUrl = `https://console.cloud.google.com/apis/library/apphosting.googleapis.com?project=${projectId}`;

    return (
        <Card className="col-span-full bg-blue-950 border-blue-800 text-blue-100">
            <CardHeader>
                <CardTitle className="text-xl text-white">Solución Definitiva de Publicación</CardTitle>
                <CardDescription className="text-blue-300">
                    Sigue estos pasos para activar el servicio que está bloqueando la publicación.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="font-semibold text-white">Paso 1: Activar el servicio</h3>
                    <p className="text-sm text-blue-200 mb-2">
                        Haz clic en el botón de abajo. Te llevará a la consola de Google Cloud. Si te pide habilitar la API, haz clic en el botón azul "Habilitar". Si ya está habilitada, no hagas nada.
                    </p>
                    <Button asChild>
                        <a href={aphaApiUrl} target="_blank" rel="noopener noreferrer">
                            Activar App Hosting API <ArrowRight className="ml-2 h-4 w-4" />
                        </a>
                    </Button>
                </div>
                 <div>
                    <h3 className="font-semibold text-white">Paso 2: Publicar</h3>
                    <p className="text-sm text-blue-200">
                        Después de habilitar la API, regresa a Firebase Studio, cierra la ventana de publicación y vuelve a hacer clic en "Publicar". El error desaparecerá.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}


export default function DashboardPage() {
    return (
        <div className="flex flex-col h-full">
            <PageHeader title="Áreas de Gestión" />
            <main className="flex-grow p-4 sm:p-6">
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                    <FinalSolutionCard />
                    {mainFeatures.map((link) => (
                        <Link href={link.href} key={link.title} className="block group">
                            <Card className="h-32 sm:h-36 transition-all duration-200 ease-in-out hover:shadow-lg hover:-translate-y-1 hover:border-primary/30">
                                <CardContent className="flex flex-col items-center justify-center h-full gap-2 p-4">
                                    {link.icon}
                                    <span className="text-sm font-medium text-center text-foreground">{link.title}</span>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    )
}
