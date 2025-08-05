"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { FeatureGroup, Polygon, Tooltip } from 'react-leaflet';
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
    onLoteSelect: (id: string | null) => void;
    selectedLote: string | null;
}

const getColorForLote = (loteName: string) => {
    let hash = 0;
    for (let i = 0; i < loteName.length; i++) {
        hash = loteName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - color.length) + color;
};

export default function MapEditor({ initialPolygons, selectedLote, onLoteSelect }: MapEditorProps) {
    const { refreshData } = useMasterData();
    const { toast } = useToast();
    const [polygons, setPolygons] = useState(initialPolygons);
    const featureGroupRef = React.useRef<L.FeatureGroup>(null);

    useEffect(() => {
        setPolygons(initialPolygons);
    }, [initialPolygons]);

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
            onLoteSelect(null);
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
    )
}