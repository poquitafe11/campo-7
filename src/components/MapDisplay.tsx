
"use client";

import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LoteData } from '@/lib/types';
import { useMemo } from 'react';

// Fix for Leaflet's default icon issue with Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface MapDisplayProps {
  lotePolygons: (LoteData & { color: string })[];
}

const getColorForLote = (loteName: string) => {
    let hash = 0;
    for (let i = 0; i < loteName.length; i++) {
        hash = loteName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - color.length) + color;
};

export default function MapDisplay({ lotePolygons: initialPolygons }: { lotePolygons: LoteData[] }) {

  const polygonsToRender = useMemo(() => {
    return initialPolygons.map(lote => {
      if (!lote.geoJSON) return null;
      try {
        const geojson = JSON.parse(lote.geoJSON);
        const coordinates = geojson.geometry.coordinates[0].map((coord: [number, number]) => [coord[1], coord[0]]);
        return {
          ...lote,
          position: coordinates,
          color: getColorForLote(lote.lote),
        };
      } catch (e) {
        console.error("Failed to parse GeoJSON", e);
        return null;
      }
    }).filter(p => p !== null);
  }, [initialPolygons]);
    
  return (
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

        {polygonsToRender.map(lote => (
           lote && (
                <Polygon key={lote.id} positions={lote.position as L.LatLngExpression[]} pathOptions={{ color: lote.color, fillColor: lote.color, fillOpacity: 0.5 }}>
                    <Tooltip sticky>
                        <strong>Lote:</strong> {lote.lote}<br />
                        <strong>Variedad:</strong> {lote.variedad}<br />
                        <strong>Ha:</strong> {lote.ha.toFixed(2)}
                    </Tooltip>
                </Polygon>
            )
        ))}
    </MapContainer>
  );
}
