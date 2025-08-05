"use client";

import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';

const MapView = dynamic(() => import('@/components/MapView'), {
    ssr: false,
    loading: () => (
        <div className="flex h-[calc(100vh-8rem)] w-full items-center justify-center rounded-lg border bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    ),
});

export default function MapsPage() {
  return (
    <div className="h-[calc(100vh-8rem)] w-full">
        <MapView />
    </div>
  );
}
