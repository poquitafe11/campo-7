
"use client";

import { useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useMasterData } from '@/context/MasterDataContext';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

// Fix for Leaflet's default icon issue with Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});


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
            <MapContainer
                center={[-14.07, -75.72]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {lotePolygons.map(lote => (
                    <Polygon key={lote.id} positions={lote.position} pathOptions={{ color: lote.color, fillColor: lote.color, fillOpacity: 0.5 }}>
                        <Tooltip sticky>
                            <strong>Lote:</strong> {lote.lote}<br />
                            <strong>Variedad:</strong> {lote.variedad}<br />
                            <strong>Ha:</strong> {lote.ha.toFixed(2)}
                        </Tooltip>
                    </Polygon>
                ))}
            </MapContainer>
        </div>
    </div>
  );
}
