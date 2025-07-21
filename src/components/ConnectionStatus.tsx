
"use client";

import { useOnlineStatus, type NetworkStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, LoaderCircle } from 'lucide-react';

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

export default function ConnectionStatus() {
  const status = useOnlineStatus();
  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2 p-2 text-sm font-medium", config.className)}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
