
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
  BookText,
  Layers,
  LifeBuoy,
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
    href: "/maestros",
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
    if (item.href === "/dashboard") return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <SidebarMenu>
      {navItems.map((item) =>
        item.items ? (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton
              href={item.href}
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
                    isActive={pathname.startsWith(subItem.href)}
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
              isActive={isParentActive(item)}
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
