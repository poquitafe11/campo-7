"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookText, Layers, LifeBuoy } from "lucide-react";

const quickAccessLinks = [
  {
    title: "Gestión de Usuarios",
    description: "Administra los usuarios y sus permisos.",
    href: "/users",
    icon: <Users className="h-8 w-8 text-primary" />,
  },
  {
    title: "Maestro de Lotes",
    description: "Configura los datos de los lotes de cultivo.",
    href: "/maestro-lotes",
    icon: <Layers className="h-8 w-8 text-primary" />,
  },
  {
    title: "Maestro de Labores",
    description: "Define las labores agrícolas y sus códigos.",
    href: "/maestro-labores",
    icon: <BookText className="h-8 w-8 text-primary" />,
  },
  {
    title: "Asistentes",
    description: "Gestiona el personal y los asistentes.",
    href: "/asistentes",
    icon: <LifeBuoy className="h-8 w-8 text-primary" />,
  },
];


export default function DashboardPage() {
    return (
        <>
            <PageHeader title="Áreas de Gestión" />
            <div className="p-4 sm:p-6 lg:p-8 pt-0">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {quickAccessLinks.map((link) => (
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
