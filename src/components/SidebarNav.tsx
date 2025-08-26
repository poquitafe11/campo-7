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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

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

  useMemo(() => {
    if (isExpanded) {
        if(isMastersActive) setActiveAccordion('maestros');
    } else {
        setActiveAccordion('');
    }
  }, [isExpanded, isMastersActive]);

  const visibleLinks = useMemo(() => {
    if (!profile) return { main: [], masters: [] };
    if (profile.rol === 'Admin') {
      return { main: mainLinks, masters: masterLinks };
    }
    return { main: mainLinks.filter(l => l.href !== '/users'), masters: masterLinks };
  }, [profile]);
  
  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    return pathname.startsWith(href);
  };
  
  const NavLink = ({ href, label, icon: Icon, disabled = false }: { href: string; label: string; icon: React.ElementType; disabled?: boolean }) => {
    const linkContent = (
      <div className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-muted-foreground transition-all hover:bg-sidebar-accent/20 hover:text-sidebar-foreground',
        isActive(href) && 'bg-sidebar-accent text-sidebar-foreground',
        disabled && 'cursor-not-allowed opacity-50',
        !isExpanded && "justify-center"
      )}>
        <Icon className="h-5 w-5" />
        {isExpanded && <span className="truncate">{label}</span>}
      </div>
    );

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
             <Link href={!disabled ? href : '#'} className="block">
                {linkContent}
             </Link>
          </TooltipTrigger>
          {!isExpanded && (
            <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-accent">
              <p>{label}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <nav className="grid items-start gap-1 p-2 text-sm font-medium">
      {visibleLinks.main.map((link) => (
        <NavLink key={link.href} {...link} />
      ))}
      
      <Accordion type="single" collapsible value={activeAccordion} onValueChange={setActiveAccordion} disabled={!isExpanded}>
        <AccordionItem value="maestros" className="border-none">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild disabled={isExpanded}>
                <AccordionTrigger className={cn(
                    'flex items-center w-full gap-3 rounded-lg px-3 py-2 text-sidebar-muted-foreground transition-all hover:bg-sidebar-accent/20 hover:text-sidebar-foreground hover:no-underline [&>svg]:size-5',
                    isMastersActive && 'bg-sidebar-accent text-sidebar-foreground',
                    !isExpanded && 'justify-center'
                )}>
                  <div className="flex items-center gap-3">
                    <Layers className="h-5 w-5" />
                    {isExpanded && <span className="flex-1 text-left truncate">Maestros</span>}
                  </div>
                </AccordionTrigger>
              </TooltipTrigger>
              {!isExpanded && <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-accent"><p>Maestros</p></TooltipContent>}
            </Tooltip>
          </TooltipProvider>
          <AccordionContent className="pt-1 pl-4 space-y-1">
            {visibleLinks.masters.map((link) => (
               <NavLink key={link.href} {...link} />
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </nav>
  );
}