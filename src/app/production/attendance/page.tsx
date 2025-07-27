"use client";

import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";
import { UserCheck, Database, BarChart3 } from "lucide-react";

const attendanceFeatures = [
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

export default function AttendancePage() {
  return (
    <>
      <PageHeaderWithNav title="Asistencia de Personal" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {attendanceFeatures.map((feature) => (
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
    </>
  );
}
