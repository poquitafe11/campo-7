"use client";

import React, { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// This is a common workaround for the "Map container is already initialized" error in React 18+.
// We ensure the map container is rendered only once on the client side.
export default function MapView() {
    const [map, setMap] = useState<L.Map | null>(null);

    return (
        <MapContainer
            center={[-14.07, -75.72]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            className="rounded-lg border overflow-hidden"
            whenCreated={setMap}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
        </MapContainer>
    );
}