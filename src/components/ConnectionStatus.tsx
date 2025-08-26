"use client";

import { useOnlineStatus, type NetworkStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const statusConfig: { [key in NetworkStatus]: { text: string; icon: React.ReactNode; className: string } } = {
  online: {
    text: 'Conectado',
    icon: <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>,
    className: 'text-green-600',
  },
  offline: {
    text: 'Sin conexión',
    icon: <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>,
    className: 'text-red-600',
  },
  syncing: {
    text: 'Sincronizando...',
    icon: <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse"></span>,
    className: 'text-yellow-500',
  },
};

export default function ConnectionStatus({ isExpanded }: { isExpanded: boolean }) {
  const status = useOnlineStatus();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  const config = statusConfig[status];

  if (!isExpanded) {
    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger className="w-full">
                    <div className={cn("flex items-center justify-center gap-2 p-2 text-sm font-medium", config.className)}>
                        {config.icon}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-accent">
                    <p>{config.text}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
  }

  return (
    <div className={cn("flex items-center gap-2 p-2 text-sm font-medium", config.className)}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
