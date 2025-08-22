
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMasterData } from '@/context/MasterDataContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { format, differenceInDays, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as xlsx from 'xlsx';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';

type HealthRecord = {
    id: string;
    fechaAplicacion?: string;
    'Fecha Plan de Aplicación'?: string;
    [key: string]: any;
};

const parseCustomDate = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;

    const months: { [key: string]: number } = {
        ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
        jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11
    };
    
    const parts = dateString.toLowerCase().replace(/\./g, '').split(/[\/-]/);
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const monthAbbr = parts[1].substring(0, 3);
    const year = parseInt(parts[2], 10);
    
    const month = months[monthAbbr];
    if (month === undefined || isNaN(day) || isNaN(year)) return null;

    // Handle two-digit year, assume 20xx
    const fullYear = year < 100 ? 2000 + year : year;

    const date = new Date(fullYear, month, day);
    return isValid(date) ? date : null;
};


export default function HealthSummaryPage() {
    const { toast } = useToast();
    const { lotes, loading: masterLoading } = useMasterData();
    const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const { setActions } = useHeaderActions();
    
    const lotesMap = useMemo(() => {
        const map = new Map<string, any>();
        lotes.forEach(lote => {
            if (!map.has(lote.lote)) {
                map.set(lote.lote, lote);
            }
        });
        return map;
    }, [lotes]);


    useEffect(() => {
        setLoading(true);
        const unsubscribe = onSnapshot(collection(db, "registros-sanidad"), (snapshot) => {
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthRecord));
            setHealthRecords(records);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching health records: ", error);
            toast({ variant: "destructive", title: "Error de Carga", description: "No se pudieron cargar los registros de sanidad." });
            setLoading(false);
        });
        return () => unsubscribe();
    }, [toast]);

    const processedData = useMemo(() => {
        // Step 1: Normalize records
        const normalized = healthRecords.map(r => ({
            ...r,
            fechaAplicacion: r.fechaAplicacion || r['Fecha Plan de Aplicación'] || '',
            lote: String(r['lote'] || r['Lote'] || ''),
            cuarteles: String(r['cuartel'] || r['Cuartel'] || ''),
            producto: String(r['producto'] || r['Producto'] || ''),
            ingredienteActivo: String(r['ingredienteActivo'] || r['Ingrediente Activo'] || ''),
        }));

        // Step 2: Group applications by a reliable key
        const groupedByApplication: { [key: string]: HealthRecord & { cuarteles: Set<string> } } = {};
        
        normalized.forEach(record => {
            const date = record.fechaAplicacion;
            const product = record.producto;
            const ingredient = record.ingredienteActivo;
            
            // Only group if product and ingredient are defined, otherwise treat as unique
            const key = (date && product && ingredient) 
                      ? `${date}-${product}-${ingredient}` 
                      : record.id; // Use record ID as a fallback key for unique entries

            if (!groupedByApplication[key]) {
                groupedByApplication[key] = { ...record, cuarteles: new Set() };
            }
            if (record.cuarteles) {
                groupedByApplication[key].cuarteles.add(record.cuarteles);
            }
        });
        
        // Step 3: Map to final format for display
        return Object.values(groupedByApplication).map(record => ({
            ...record,
            cuarteles: Array.from(record.cuarteles).join(', '),
            parsedDate: parseCustomDate(record.fechaAplicacion)
        })).sort((a, b) => {
           if (a.parsedDate && b.parsedDate) {
               return b.parsedDate.getTime() - a.parsedDate.getTime();
           }
           if (a.parsedDate) return -1;
           if (b.parsedDate) return 1;
           return 0; // Keep original order if dates are invalid
        });
           
    }, [healthRecords]);

    const handleDownload = useCallback(() => {
        const dataToExport = processedData.map(record => {
            const loteMaster = lotesMap.get(record.lote);
            let ddc = 'N/A';
            if(loteMaster?.fechaCianamida && record.parsedDate && isValid(loteMaster.fechaCianamida) && isValid(record.parsedDate)) {
              ddc = differenceInDays(record.parsedDate, loteMaster.fechaCianamida).toString();
            }
            return {
                'Fecha': record.parsedDate ? format(record.parsedDate, 'dd/MM/yyyy', { locale: es }) : 'Fecha inválida',
                'DDC': ddc,
                'Lote': record.lote,
                'Cuartel(es)': record.cuarteles,
                'Producto': record['producto'],
                'Ingrediente Activo': record['ingredienteActivo'],
                'Días Transcurridos': 'N/A', // Omit calculation
            };
        });

        if (dataToExport.length === 0) {
            toast({ variant: "destructive", title: "Sin Datos", description: "No hay datos para exportar." });
            return;
        }

        const worksheet = xlsx.utils.json_to_sheet(dataToExport);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "ResumenSanidad");
        xlsx.writeFile(workbook, "ResumenSanidad.xlsx");
        toast({ title: "Descarga Iniciada", description: "El archivo se está descargando." });
    }, [processedData, lotesMap, toast]);
    
    useEffect(() => {
        setActions(
          <Button variant="ghost" size="icon" onClick={handleDownload} disabled={processedData.length === 0} className="h-9 w-9">
            <FileDown className="h-5 w-5" />
          </Button>
        );
        return () => setActions(null);
    }, [setActions, handleDownload, processedData]);

    const isContentReady = !loading && !masterLoading;

    return (
        <div className="space-y-6">
            {!isContentReady ? (
                <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Detalle de Aplicaciones</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>DDC</TableHead>
                                            <TableHead>Lote</TableHead>
                                            <TableHead>Cuartel(es)</TableHead>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Ingrediente Activo</TableHead>
                                            <TableHead>Días Transcurridos</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {processedData.length > 0 ? (
                                            processedData.map((record) => {
                                                const loteMaster = lotesMap.get(record.lote);
                                                let ddc = 'N/A';
                                                if(loteMaster?.fechaCianamida && record.parsedDate && isValid(loteMaster.fechaCianamida) && isValid(record.parsedDate)) {
                                                  ddc = differenceInDays(record.parsedDate, loteMaster.fechaCianamida).toString();
                                                }
                                                
                                                return (
                                                    <TableRow key={record.id}>
                                                        <TableCell>{record.parsedDate && isValid(record.parsedDate) ? format(record.parsedDate, 'dd/MM/yyyy', { locale: es }) : 'Fecha Inválida'}</TableCell>
                                                        <TableCell>{ddc}</TableCell>
                                                        <TableCell>{record.lote}</TableCell>
                                                        <TableCell>{record.cuarteles}</TableCell>
                                                        <TableCell>{record['producto']}</TableCell>
                                                        <TableCell>{record['ingredienteActivo']}</TableCell>
                                                        <TableCell>N/A</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center">No hay datos de sanidad registrados.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
