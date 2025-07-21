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
  ClipboardList
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
    items: [
      { href: "/maestro-lotes", label: "Lotes" },
      { href: "/maestro-labores", label: "Labores" },
      { href: "/asistentes", label: "Asistentes" },
    ],
  },
  {
    label: "Producción",
    icon: <Tractor />,
    items: [
        { href: "/production/attendance", label: "Asistencia" },
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

  return (
    <SidebarMenu>
      {navItems.map((item) =>
        item.items ? (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton
              isActive={item.items.some((sub) => pathname.startsWith(sub.href))}
            >
              {item.icon}
              <span>{item.label}</span>
            </SidebarMenuButton>
            <SidebarMenuSub>
              {item.items.map((subItem) => (
                <SidebarMenuSubItem key={subItem.href}>
                  <SidebarMenuSubButton
                    href={subItem.href}
                    isActive={pathname === subItem.href}
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
              isActive={pathname === item.href}
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
