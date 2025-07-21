
"use client"

import { usePathname } from "next/navigation"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import {
  Tractor,
  Users,
  LayoutGrid,
  Layers,
} from "lucide-react"

const navItems = [
  {
    href: "/dashboard",
    icon: <LayoutGrid />,
    label: "Dashboard",
  },
  {
    label: "Maestros",
    icon: <Layers />,
    href: "/maestros", // Parent href for active state check
    items: [
      { href: "/maestro-lotes", label: "Lotes" },
      { href: "/maestro-labores", label: "Labores" },
      { href: "/asistentes", label: "Asistentes" },
    ],
  },
  {
    href: "/production",
    label: "Producción",
    icon: <Tractor />,
    items: [
        { href: "/production/attendance", label: "Asistencia" },
        { href: "/production/daily-report", label: "Parte Diario" },
    ]
  },
  {
    href: "/users",
    icon: <Users />,
    label: "Usuarios",
  },
]

export function SidebarNav() {
  const pathname = usePathname()

  const isParentActive = (item: (typeof navItems)[number]) => {
    if (!item.href) return false;
    // For parent items, check if the current path starts with the item's href
    return item.items && pathname.startsWith(item.href);
  };
  
  const isChildActive = (href: string) => {
    // Exact match or starts with the href followed by a slash
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <SidebarMenu>
      {navItems.map((item) =>
        item.items ? (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton
              isActive={isParentActive(item)}
            >
              {item.icon}
              <span>{item.label}</span>
            </SidebarMenuButton>
            <SidebarMenuSub>
              {item.items.map((subItem) => (
                <SidebarMenuSubItem key={subItem.href}>
                  <SidebarMenuSubButton
                    href={subItem.href}
                    isActive={isChildActive(subItem.href)}
                  >
                    {subItem.label}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </SidebarMenuItem>
        ) : (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              href={item.href}
              isActive={isChildActive(item.href!)}
            >
              {item.icon}
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      )}
    </SidebarMenu>
  )
}
