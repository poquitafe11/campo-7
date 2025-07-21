
"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tractor, HeartPulse, Droplets, BadgeCheck, Bug, BotMessageSquare } from "lucide-react";

const mainFeatures = [
  {
    title: "Producción",
    description: "Gestiona partes diarios, asistencia y actividades.",
    href: "/production",
    icon: <Tractor className="h-8 w-8 text-primary" />,
  },
  {
    title: "Sanidad",
    description: "Registra observaciones de plagas y enfermedades.",
    href: "/health",
    icon: <HeartPulse className="h-8 w-8 text-primary" />,
  },
  {
    title: "Riego",
    description: "Monitorea el uso de agua y la duración del riego.",
    href: "/irrigation",
    icon: <Droplets className="h-8 w-8 text-primary" />,
  },
  {
    title: "Control de Calidad",
    description: "Realiza seguimiento de la calidad de la cosecha.",
    href: "/quality-control",
    icon: <BadgeCheck className="h-8 w-8 text-primary" />,
  },
  {
    title: "Control Biológico",
    description: "Administra la liberación de agentes biológicos.",
    href: "/biological-control",
    icon: <Bug className="h-8 w-8 text-primary" />,
  },
   {
    title: "Asistente IA",
    description: "Consulta tus datos usando inteligencia artificial.",
    href: "/queries",
    icon: <BotMessageSquare className="h-8 w-8 text-primary" />,
  },
];


export default function DashboardPage() {
    return (
        <>
            <PageHeader title="Dashboard Principal" />
            <div className="p-4 sm:p-6 lg:p-8 pt-0">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mainFeatures.map((link) => (
                    <Link href={link.href} key={link.title} className="block group">
                        <Card className="h-full transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1 hover:border-primary/50">
                        <CardHeader>
                            <div className="mb-3">{link.icon}</div>
                            <CardTitle>{link.title}</CardTitle>
                            <CardDescription className="pt-1">{link.description}</CardDescription>
                        </CardHeader>
                        </Card>
                    </Link>
                    ))}
                </div>
            </div>
        </>
    )
}
