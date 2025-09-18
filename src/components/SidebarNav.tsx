
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
  Truck,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import FeaturePermissionsDialog from './FeaturePermissionsDialog';
import { Button } from './ui/button';

const mainLinks = [
  { href: '/dashboard', label: 'Áreas', icon: LayoutGrid, title: 'Áreas de Gestión' },
  { href: '/users', label: 'Usuarios', icon: Shield, title: 'Gestión de Usuarios' },
  { href: '/maps', label: 'Mapas', icon: Map, disabled: true, title: 'Mapas' },
];

const masterLinks = [
  { href: '/maestro-lotes', label: 'Lotes', icon: Box, title: 'Maestro de Lotes' },
  { href: '/maestro-labores', label: 'Labores', icon: Layers, title: 'Maestro de Labores' },
  { href: '/maestro-trabajadores', label: 'Trabajadores', icon: Users, title: 'Maestro de Trabajadores' },
  { href: '/asistentes', label: 'Asistentes', icon: Users, title: 'Gestión de Asistentes' },
  { href: '/maestro-jaladores', label: 'Jaladores', icon: Truck, title: 'Maestro de Jaladores' },
  { href: '/min-max', label: 'Mínimos y Máximos', icon: Thermometer, title: 'Mínimos y Máximos' },
  { href: '/presupuesto', label: 'Presupuesto', icon: ScrollText, title: 'Presupuesto' },
];

interface SidebarNavProps {
  isExpanded: boolean;
}

export function SidebarNav({ isExpanded }: SidebarNavProps) {
  const pathname = usePathname();
  const { profile } = useAuth();
  
  const isMastersActive = masterLinks.some(link => pathname.startsWith(link.href));
  const [activeAccordion, setActiveAccordion] = useState(isMastersActive ? 'maestros' : '');

  const [isPermissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<{title: string, href: string} | null>(null);

  const handlePermissionSettings = (e: React.MouseEvent, feature: {title: string, href: string}) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFeature(feature);
    setPermissionsDialogOpen(true);
  }

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
  
  const NavLink = ({ href, label, icon: Icon, disabled = false, title }: { href: string; label: string; icon: React.ElementType; disabled?: boolean; title: string }) => {
    const linkContent = (
      <div className={cn(
        'group flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sidebar-muted-foreground transition-all hover:bg-sidebar-accent/20 hover:text-sidebar-foreground',
        isActive(href) && 'bg-sidebar-accent text-sidebar-foreground',
        !isExpanded && 'justify-center',
        disabled && 'cursor-not-allowed opacity-50'
      )}>
        <div className="flex items-center gap-3 overflow-hidden">
          <Icon className="h-5 w-5 flex-shrink-0" />
          {isExpanded && <span className="truncate">{label}</span>}
        </div>
        {isExpanded && profile?.rol === 'Admin' && href !== '/dashboard' && !disabled && (
           <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => handlePermissionSettings(e, { title, href })}
            >
                <Settings className="h-4 w-4" />
            </Button>
        )}
      </div>
    );
    
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
              <Link href={!disabled ? href : '#'}>
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
    <>
      <nav className="grid items-start gap-1 p-2 text-sm font-medium">
        {visibleLinks.main.map((link) => (
          <NavLink key={link.href} {...link} />
        ))}
        
        <Accordion type="single" collapsible value={activeAccordion} onValueChange={setActiveAccordion}>
          <AccordionItem value="maestros" className="border-none">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild className="w-full">
                  <AccordionTrigger className={cn(
                      'flex items-center w-full justify-start gap-3 rounded-lg px-3 py-2 text-sidebar-muted-foreground transition-all hover:bg-sidebar-accent/20 hover:no-underline hover:text-sidebar-foreground [&>svg]:size-5',
                      isMastersActive && 'bg-sidebar-accent text-sidebar-foreground',
                      !isExpanded && 'justify-center'
                    )}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Layers className="h-5 w-5 flex-shrink-0" />
                        {isExpanded && <span className="flex-1 text-left truncate">Maestros</span>}
                      </div>
                  </AccordionTrigger>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-accent">
                    <p>Maestros</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <AccordionContent className={cn("pt-1 space-y-1", isExpanded ? "pl-4" : "pl-0")}>
              {visibleLinks.masters.map((link) => (
                <NavLink key={link.href} {...link} />
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </nav>
      {selectedFeature && (
          <FeaturePermissionsDialog
              isOpen={isPermissionsDialogOpen}
              onOpenChange={setPermissionsDialogOpen}
              feature={selectedFeature}
              onSuccess={() => setPermissionsDialogOpen(false)}
          />
      )}
    </>
  );
}
