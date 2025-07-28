
"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import {
  Tractor,
  ShieldCheck,
  Droplets,
  ClipboardCheck,
  Bug,
  Lightbulb,
  PieChart,
} from "lucide-react";

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

export default function DashboardPage() {
    return (
        <div className="flex flex-col h-full">
            <PageHeader title="Áreas de Gestión" />
            <main className="flex-grow p-4 sm:p-0">
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
