"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Layers,
  Box,
  Users,
  Thermometer,
  ScrollText,
  Shield,
  Map,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const mainLinks = [
  { href: '/dashboard', label: 'Áreas', icon: LayoutGrid },
  { href: '/users', label: 'Usuarios', icon: Shield },
  { href: '/maps', label: 'Mapas', icon: Map, disabled: true },
];

const masterLinks = [
  { href: '/maestro-lotes', label: 'Lotes', icon: Box },
  { href: '/maestro-labores', label: 'Labores', icon: Layers },
  { href: '/maestro-trabajadores', label: 'Trabajadores', icon: Users },
  { href: '/asistentes', label: 'Asistentes', icon: Users },
  { href: '/min-max', label: 'Mínimos y Máximos', icon: Thermometer },
  { href: '/presupuesto', label: 'Presupuesto', icon: ScrollText },
];

interface SidebarNavProps {
  isExpanded: boolean;
}

export function SidebarNav({ isExpanded }: SidebarNavProps) {
  const pathname = usePathname();
  const { profile } = useAuth();
  
  const isMastersActive = masterLinks.some(link => pathname.startsWith(link.href));
  const [activeAccordion, setActiveAccordion] = useState(isMastersActive ? 'maestros' : '');

  const visibleLinks = useMemo(() => {
    if (!profile) return { main: [], masters: [] };
    if (profile.rol === 'Admin') {
      return { main: mainLinks, masters: masterLinks };
    }
    return { main: mainLinks, masters: masterLinks };
  }, [profile]);
  
  const isActive = (href: string) => {
    return pathname === href || (href !== '/' && pathname.startsWith(href));
  };
  
  const NavLink = ({ href, label, icon: Icon, disabled = false }: { href: string; label: string; icon: React.ElementType; disabled?: boolean }) => (
    <Link
      href={!disabled ? href : '#'}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-muted-foreground transition-all hover:bg-sidebar-accent/20 hover:text-sidebar-foreground',
        isActive(href) && 'bg-sidebar-accent text-sidebar-foreground',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );

  return (
    <nav className="grid items-start gap-1 p-2 text-sm font-medium">
        {visibleLinks.main.map((link) => (
            <NavLink key={link.href} {...link} />
        ))}
        
        <Accordion type="single" collapsible value={activeAccordion} onValueChange={setActiveAccordion}>
          <AccordionItem value="maestros" className="border-none">
            <AccordionTrigger className={cn(
                'flex items-center w-full gap-3 rounded-lg px-3 py-2 text-sidebar-muted-foreground transition-all hover:bg-sidebar-accent/20 hover:text-sidebar-foreground hover:no-underline',
                isMastersActive && 'bg-sidebar-accent text-sidebar-foreground'
            )}>
              <Layers className="h-4 w-4" />
              <span className="flex-1 text-left">Maestros</span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pl-7 space-y-1">
              {visibleLinks.masters.map((link) => (
                 <NavLink key={link.href} {...link} />
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
    </nav>
  );
}
