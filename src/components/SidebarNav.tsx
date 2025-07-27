"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Tractor,
  Users,
  LayoutGrid,
  Layers,
  ChevronDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"


const navItems = [
  {
    href: "/dashboard",
    icon: <LayoutGrid className="h-5 w-5" />,
    label: "Dashboard",
  },
  {
    label: "Maestros",
    icon: <Layers className="h-5 w-5" />,
    href: "/maestros", // Parent href for active state check
    items: [
      { href: "/maestro-lotes", label: "Lotes" },
      { href: "/maestro-labores", label: "Labores" },
      { href: "/asistentes", label: "Asistentes" },
      { href: "/min-max", label: "Min y Max" },
      { href: "/presupuesto", label: "Presupuesto" },
    ],
  },
  {
    href: "/production",
    label: "Producción",
    icon: <Tractor className="h-5 w-5" />,
    items: [
        { href: "/production/attendance", label: "Asistencia" },
        { href: "/production/daily-report", label: "Parte Diario" },
        { href: "/production/activities", label: "Actividades" },
    ]
  },
  {
    href: "/users",
    icon: <Users className="h-5 w-5" />,
    label: "Usuarios",
  },
]

export function SidebarNav() {
  const pathname = usePathname()

  const isParentActive = (item: (typeof navItems)[number]) => {
    if (!item.href) return false;
    return item.items && pathname.startsWith(item.href);
  };
  
  const isChildActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
     <nav className="grid items-start gap-1 px-2 text-sm font-medium">
      {navItems.map((item) =>
        item.items ? (
           <Collapsible key={item.label} defaultOpen={isParentActive(item)}>
            <CollapsibleTrigger className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary w-full", isParentActive(item) && "text-primary")}>
                {item.icon}
                <span>{item.label}</span>
                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-[data-state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4">
                 <div className="grid gap-1 mt-1">
                 {item.items.map((subItem) => (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                        isChildActive(subItem.href) && "bg-muted text-primary"
                      )}
                    >
                      {subItem.label}
                    </Link>
                  ))}
                 </div>
            </CollapsibleContent>
           </Collapsible>
        ) : (
          <Link
            key={item.href}
            href={item.href!}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
              isChildActive(item.href!) && "bg-muted text-primary"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      )}
    </nav>
  )
}
