
"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Tractor, 
  ShieldCheck, 
  Droplets, 
  ClipboardCheck, 
  User, 
  Lightbulb, 
  FileText, 
  Bug,
  LogOut,
  PanelLeft,
  BookText,
  Layers,
  Users,
  CircleDollarSign,
  LifeBuoy,
  UserPlus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const features = [
  {
    icon: <Tractor className="h-10 w-10 text-primary" />,
    title: "Producción",
    href: "/production",
  },
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: "Sanidad",
    href: "/health",
  },
  {
    icon: <Droplets className="h-10 w-10 text-primary" />,
    title: "Riego",
    href: "/irrigation",
  },
  {
    icon: <ClipboardCheck className="h-10 w-10 text-primary" />,
    title: "C. Calidad",
    href: "/quality-control",
  },
  {
    icon: <Bug className="h-10 w-10 text-primary" />,
    title: "C. Biologico",
    href: "/biological-control",
  },
  {
    icon: <Lightbulb className="h-10 w-10 text-primary" />,
    title: "Consultas",
    href: "/queries",
  },
  {
    icon: <FileText className="h-10 w-10 text-primary" />,
    title: "Resumen",
    href: "/summary",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 bg-card text-card-foreground sticky top-0 z-10 shadow-md">
        <div className="w-10 flex justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <PanelLeft className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="p-2">
                <p className="text-sm font-semibold">Nombre de Usuario</p>
                <p className="text-xs text-muted-foreground">Admin</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Maestros</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/maestro-labores">
                  <BookText className="mr-2 h-4 w-4" />
                  <span>Maestro de Labores</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/maestro-lotes">
                  <Layers className="mr-2 h-4 w-4" />
                  <span>Datos de Lotes</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Users className="mr-2 h-4 w-4" />
                <span>Maestro de Personal</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CircleDollarSign className="mr-2 h-4 w-4" />
                <span>Presupuesto</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
               <DropdownMenuLabel>Configuración</DropdownMenuLabel>
              <DropdownMenuItem>
                <LifeBuoy className="mr-2 h-4 w-4" />
                <span>Asistentes</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UserPlus className="mr-2 h-4 w-4" />
                <span>Agregar Usuarios</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <h1 className="text-xl font-bold text-foreground">Áreas de Gestión</h1>
        <div className="w-10 flex justify-end">
           <Button variant="ghost" size="icon" className="rounded-full">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
              ></path>
            </svg>
          </Button>
        </div>
      </header>
      
      <main className="flex-grow p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
          {features.map((feature) => (
            <Link href={feature.href} key={feature.title} className="block">
              <Card className="aspect-square flex flex-col items-center justify-center p-2 transition-transform hover:scale-105 hover:shadow-lg rounded-xl bg-card">
                <CardContent className="p-0 flex flex-col items-center justify-center gap-2">
                  {feature.icon}
                  <p className="font-semibold text-center text-card-foreground text-sm">{feature.title}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
