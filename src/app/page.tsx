import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tractor, ShieldCheck, Droplets, ClipboardCheck, Bug, Lightbulb, PieChart, PanelLeft, CircleUserRound } from "lucide-react";

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
    icon: <PieChart className="h-10 w-10 text-primary" />,
    title: "Resumen",
    href: "/summary",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 bg-primary text-primary-foreground sticky top-0 z-10">
        <Button variant="ghost" size="icon">
          <PanelLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-semibold">Áreas de Gestión</h1>
        <Button variant="ghost" size="icon">
          <CircleUserRound className="h-6 w-6" />
        </Button>
      </header>
      
      <main className="flex-grow p-4">
        <div className="grid grid-cols-2 gap-4">
          {features.map((feature) => (
            <Link href={feature.href} key={feature.title}>
              <Card className="aspect-square flex flex-col items-center justify-center p-4 transition-transform hover:scale-105 hover:shadow-lg">
                <CardContent className="p-0 flex flex-col items-center justify-center gap-2">
                  {feature.icon}
                  <p className="font-semibold text-center text-card-foreground">{feature.title}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
