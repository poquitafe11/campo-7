
"use client";

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useMasterData } from '@/context/MasterDataContext';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const MapEditor = dynamic(() => import('@/components/MapEditor'), { 
    loading: () => <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
    ssr: false 
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
    <div className="flex flex-col h-full">
        <PageHeader title="Mapa del Campo" />
        <div className="flex-grow h-[calc(100vh-12rem)] rounded-lg border overflow-hidden">
            <MapEditor initialPolygons={polygons as any[]} />
        </div>
    </div>
  );
}
