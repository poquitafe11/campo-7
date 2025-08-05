"use client";

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useMasterData } from '@/context/MasterDataContext';
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
  const { lotes, loading } = useMasterData();

  const polygons = useMemo(() => {
    return lotes.map(lote => {
        if (lote.geoJSON) {
            try {
                const geoJson = JSON.parse(lote.geoJSON);
                if (geoJson.geometry && geoJson.geometry.coordinates) {
                   return {
                        id: lote.id,
                        lote: lote.lote,
                        cuartel: lote.cuartel,
                        variedad: lote.variedad,
                        ha: lote.ha,
                        geoJSON: lote.geoJSON,
                    };
                }
            } catch (e) {
                console.error("Error parsing GeoJSON for lote:", lote.lote, e);
            }
        }
        return null;
    }).filter(p => p !== null);
  }, [lotes]);
  

  if (loading) {
    return (
        <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Cargando datos de lotes...</p>
        </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] w-full">
        <MapView initialPolygons={polygons as any[]} />
    </div>
  );
}