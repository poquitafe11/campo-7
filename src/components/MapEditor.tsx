"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { FeatureGroup, Polygon, Tooltip, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Button } from './ui/button';
import { useMasterData } from '@/context/MasterDataContext';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

// Fix icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface PolygonData {
    id: string;
    lote: string;
    cuartel: string;
    variedad: string;
    ha: number;
    geoJSON: string;
}

interface MapEditorProps {
    initialPolygons: PolygonData[];
}

const getColorForLote = (loteName: string) => {
    let hash = 0;
    for (let i = 0; i < loteName.length; i++) {
        hash = loteName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - color.length) + color;
};

const MapToolbar = ({ onLoteSelect, lotes }: { onLoteSelect: (id: string | null) => void, lotes: any[] }) => {
    const map = useMap();
    
    useEffect(() => {
        const controlContainer = L.DomUtil.get('map-toolbar-container');
        if (controlContainer) {
            const selectContainer = L.DomUtil.create('div', 'leaflet-control leaflet-bar bg-white p-2 rounded-md shadow-lg');
            
            const label = L.DomUtil.create('label', 'block text-sm font-medium text-gray-700 mb-1', selectContainer);
            label.htmlFor = 'lote-select';
            label.innerText = 'Asignar polígono a:';

            const select = L.DomUtil.create('select', 'w-full p-2 border rounded', selectContainer);
            select.id = 'lote-select';

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
            
            select.onchange = (e) => onLoteSelect((e.target as HTMLSelectElement).value || null);
            
            L.DomEvent.disableClickPropagation(selectContainer);
            controlContainer.appendChild(selectContainer);
            
            return () => {
                if (controlContainer.contains(selectContainer)) {
                    controlContainer.removeChild(selectContainer);
                }
            }
        }
    }, [map, lotes, onLoteSelect]);

    return null;
}

export default function MapEditor({ initialPolygons }: MapEditorProps) {
    const { lotes: masterLotes, refreshData } = useMasterData();
    const { toast } = useToast();
    const [selectedLote, setSelectedLote] = useState<string | null>(null);
    const [polygons, setPolygons] = useState(initialPolygons);
    const featureGroupRef = React.useRef<L.FeatureGroup>(null);

    useEffect(() => {
        setPolygons(initialPolygons);
    }, [initialPolygons]);

    const lotesWithoutPolygon = useMemo(() => {
        const lotesWithPolygonIds = new Set(polygons.map(p => p.id));
        return masterLotes.filter(l => !lotesWithPolygonIds.has(l.id));
    }, [masterLotes, polygons]);

    const handleCreated = async (e: any) => {
        if (!selectedLote) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Por favor, selecciona un lote antes de dibujar.',
            });
            if (featureGroupRef.current) {
                featureGroupRef.current.removeLayer(e.layer);
            }
            return;
        }

        const geoJSON = e.layer.toGeoJSON();
        const loteRef = doc(db, 'maestro-lotes', selectedLote);

        try {
            await updateDoc(loteRef, {
                geoJSON: JSON.stringify(geoJSON),
            });
            toast({
                title: 'Éxito',
                description: `Polígono guardado para el lote seleccionado.`,
            });
            await refreshData();
            setSelectedLote(null);
        } catch (error) {
            console.error('Error saving polygon: ', error);
            toast({
                variant: 'destructive',
                title: 'Error al Guardar',
                description: 'No se pudo guardar el polígono.',
            });
        }
    };

    const handleEdited = async (e: any) => {
        for (const layer of Object.values(e.layers._layers)) {
            const geoJSON = (layer as L.Polygon).toGeoJSON();
            const polygonId = (layer as any).options.id;
            if (!polygonId) continue;
            const loteRef = doc(db, 'maestro-lotes', polygonId);
            try {
                await updateDoc(loteRef, { geoJSON: JSON.stringify(geoJSON) });
            } catch (error) {
                console.error('Error updating polygon: ', error);
                toast({ variant: 'destructive', title: 'Error al Actualizar', description: 'No se pudo actualizar el polígono.' });
            }
        }
        toast({ title: 'Éxito', description: `Polígonos actualizados.` });
        await refreshData();
    };

    const handleDeleted = async (e: any) => {
        for (const layer of Object.values(e.layers._layers)) {
            const polygonId = (layer as any).options.id;
            if (!polygonId) continue;
            const loteRef = doc(db, 'maestro-lotes', polygonId);
            try {
                await updateDoc(loteRef, { geoJSON: '' });
            } catch (error) {
                console.error('Error deleting polygon: ', error);
                toast({ variant: 'destructive', title: 'Error al Eliminar', description: 'No se pudo eliminar el polígono.' });
            }
        }
        toast({ title: 'Éxito', description: `Polígonos eliminados.` });
        await refreshData();
    };

    const polygonsToRender = useMemo(() => {
        return polygons.map(lote => {
            if (!lote.geoJSON) return null;
            try {
                const geojson = JSON.parse(lote.geoJSON);
                const coordinates = geojson.geometry.coordinates[0].map((coord: [number, number]) => [coord[1], coord[0]]);
                return { ...lote, position: coordinates, color: getColorForLote(lote.lote) };
            } catch (e) {
                return null;
            }
        }).filter(p => p !== null);
    }, [polygons]);

    return (
        <>
            <header className="absolute top-0 left-0 right-0 z-[1000] flex h-16 items-center justify-between bg-background/80 backdrop-blur-sm px-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild><Link href="/dashboard"><ArrowLeft className="h-5 w-5" /></Link></Button>
                    <h1 className="text-lg font-bold">Editor de Mapas</h1>
                </div>
                <Button variant="ghost" size="icon" asChild><Link href="/dashboard"><LayoutGrid className="h-5 w-5" /></Link></Button>
            </header>
             <div id="map-toolbar-container" className="leaflet-top leaflet-left mt-20 ml-2"></div>
            <FeatureGroup ref={featureGroupRef}>
                <EditControl
                    position="topright"
                    onCreated={handleCreated}
                    onEdited={handleEdited}
                    onDeleted={handleDeleted}
                    draw={{
                        rectangle: false,
                        circle: false,
                        circlemarker: false,
                        marker: false,
                        polyline: false,
                    }}
                />
                {polygonsToRender.map(lote => (
                    lote && (
                        <Polygon key={lote.id} positions={lote.position as L.LatLngExpression[]} pathOptions={{ color: lote.color, fillColor: lote.color, fillOpacity: 0.5 }} eventHandlers={{ add: (e) => { (e.target as any).options.id = lote.id; } }}>
                            <Tooltip sticky>
                                <strong>Lote:</strong> {lote.lote} | <strong>Cuartel:</strong> {lote.cuartel}<br />
                                <strong>Variedad:</strong> {lote.variedad}<br />
                                <strong>Ha:</strong> {lote.ha.toFixed(2)}
                            </Tooltip>
                        </Polygon>
                    )
                ))}
            </FeatureGroup>
            <MapToolbar onLoteSelect={setSelectedLote} lotes={lotesWithoutPolygon} />
        </>
    );
}
