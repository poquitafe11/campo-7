
"use client";

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useMasterData } from '@/context/MasterDataContext';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

// Basic color hashing for consistent polygon colors
const getColorForLote = (loteName: string) => {
    let hash = 0;
    for (let i = 0; i < loteName.length; i++) {
        hash = loteName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - color.length) + color;
};

// Generate placeholder coordinates for lots
const generateLotCoordinates = (index: number) => {
    const baseLat = -14.067; 
    const baseLng = -75.728;
    const offset = 0.002;
    const row = Math.floor(index / 5);
    const col = index % 5;
    
    const topLeft: [number, number] = [baseLat + (row * offset), baseLng + (col * offset)];
    const topRight: [number, number] = [baseLat + (row * offset), baseLng + (col * offset) + offset];
    const bottomLeft: [number, number] = [baseLat + (row * offset) + offset, baseLng + (col * offset)];
    const bottomRight: [number, number] = [baseLat + (row * offset) + offset, baseLng + (col * offset) + offset];

    return [topLeft, topRight, bottomRight, bottomLeft];
};

export default function MapsPage() {
  const { lotes, loading } = useMasterData();

  const lotePolygons = useMemo(() => {
    const uniqueLotes = Array.from(new Map(lotes.map(lote => [lote.lote, lote])).values());
    return uniqueLotes.map((lote, index) => {
        const color = getColorForLote(lote.lote);
        const position = generateLotCoordinates(index);
        return {
            ...lote,
            color,
            position
        };
    });
  }, [lotes]);
  
  // Dynamically import the entire map display component
  const MapDisplay = useMemo(() => dynamic(() => import('@/components/MapDisplay'), { 
    loading: () => <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
    ssr: false 
  }), []);

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
            <MapDisplay lotePolygons={lotePolygons} />
        </div>
    </div>
  );
}
