
"use client";

import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet's default icon issue with Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface MapDisplayProps {
  lotePolygons: {
    id: string;
    lote: string;
    variedad: string;
    ha: number;
    color: string;
    position: [number, number][];
  }[];
}

export default function MapDisplay({ lotePolygons }: MapDisplayProps) {
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

        {lotePolygons.map(lote => (
            <Polygon key={lote.id} positions={lote.position as L.LatLngExpression[]} pathOptions={{ color: lote.color, fillColor: lote.color, fillOpacity: 0.5 }}>
                <Tooltip sticky>
                    <strong>Lote:</strong> {lote.lote}<br />
                    <strong>Variedad:</strong> {lote.variedad}<br />
                    <strong>Ha:</strong> {lote.ha.toFixed(2)}
                </Tooltip>
            </Polygon>
        ))}
    </MapContainer>
  );
}
