"use client";

import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Button } from './ui/button';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useMasterData } from '@/context/MasterDataContext';
import MapEditor from './MapEditor';

interface PolygonData {
    id: string;
    lote: string;
    cuartel: string;
    variedad: string;
    ha: number;
    geoJSON: string;
}

interface MapViewProps {
    initialPolygons: PolygonData[];
}

const MapToolbar = ({ onLoteSelect, lotes }: { onLoteSelect: (id: string | null) => void, lotes: any[] }) => {
    const map = useMap();
    const [selected, setSelected] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value || null;
        setSelected(e.target.value);
        onLoteSelect(value);
    }
    
    // We create a custom control to house the select dropdown
    useEffect(() => {
        const controlContainer = L.DomUtil.create('div', 'leaflet-control leaflet-bar bg-white p-2 rounded-md shadow-lg');
        
        const label = document.createElement('label');
        label.htmlFor = 'lote-select';
        label.className = 'block text-sm font-medium text-gray-700 mb-1';
        label.innerText = 'Asignar polígono a:';
        controlContainer.appendChild(label);

        const select = document.createElement('select');
        select.id = 'lote-select';
        select.className = 'w-full p-2 border rounded';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.innerText = 'Selecciona un lote';
        select.appendChild(defaultOption);

        lotes.forEach(lote => {
            const option = document.createElement('option');
            option.value = lote.id;
            option.innerText = `${lote.lote} - ${lote.cuartel}`;
            select.appendChild(option);
        });
        
        select.onchange = (e) => handleChange(e as any);
        controlContainer.appendChild(select);
        
        const customControl = new (L.Control.extend({
            onAdd: function() {
                return controlContainer;
            },
            onRemove: function() {}
        }))({ position: 'topleft' });

        customControl.addTo(map);

        L.DomEvent.disableClickPropagation(controlContainer);
        
        return () => {
            map.removeControl(customControl);
        }
    }, [map, lotes, onLoteSelect]);

    return null;
}

export default function MapView({ initialPolygons }: MapViewProps) {
    const { lotes: masterLotes } = useMasterData();
    const [selectedLote, setSelectedLote] = useState<string | null>(null);

    const lotesWithoutPolygon = useMemo(() => {
        const lotesWithPolygonIds = new Set(initialPolygons.map(p => p.id));
        return masterLotes.filter(l => !lotesWithPolygonIds.has(l.id));
    }, [masterLotes, initialPolygons]);
    
    return (
        <div className="h-full w-full relative">
            <header className="absolute top-0 left-0 right-0 z-[1000] flex h-16 items-center justify-between bg-background/80 backdrop-blur-sm px-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild><Link href="/dashboard"><ArrowLeft className="h-5 w-5" /></Link></Button>
                    <h1 className="text-lg font-bold">Editor de Mapas</h1>
                </div>
                <Button variant="ghost" size="icon" asChild><Link href="/dashboard"><LayoutGrid className="h-5 w-5" /></Link></Button>
            </header>
            <MapContainer
                center={[-14.07, -75.72]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                className="rounded-lg border overflow-hidden"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapEditor
                    initialPolygons={initialPolygons}
                    selectedLote={selectedLote}
                    onLoteSelect={setSelectedLote}
                />
                 <MapToolbar onLoteSelect={setSelectedLote} lotes={lotesWithoutPolygon} />
            </MapContainer>
        </div>
    );
}