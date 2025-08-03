
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
    fechaAplicacion: string;
    [key: string]: any;
};

// Define a standardized record type that we will normalize our data into.
type NormalizedHealthRecord = {
    id: string;
    campana: string;
    lote: string;
    objetivo: string;
    categoria: string;
    fechaAplicacion: string;
    [key: string]: any; // Keep other fields
};


const parseCustomDate = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;

    const months: { [key: string]: string } = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    
    const parts = dateString.toLowerCase().split(/[\/-]/);
    if (parts.length !== 3) return null;

    const day = parts[0];
    const monthAbbr = parts[1].substring(0, 3);
    const year = parts[2];
    
    const month = months[monthAbbr];
    if (!month) return null;

    let date = parse(`${year}-${month}-${day}`, 'yyyy-MM-dd', new Date());
    if (isValid(date)) return date;

    const formattedDateString = `${year}-${month}-${day}T00:00:00`;
    date = new Date(formattedDateString);

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

    const normalizedHealthRecords = useMemo(() => {
        return healthRecords.map(r => {
            const get = (key: string, alternateKey?: string, alternateKey2?: string) => {
                return r[key] || (alternateKey && r[alternateKey]) || (alternateKey2 && r[alternateKey2]) || '';
            }
            return {
                ...r, // Keep original data
                id: r.id,
                campana: get('campana', 'campaña'),
                lote: get('lote', 'Lote'),
                objetivo: get('objetivo', 'Objetivo'),
                categoria: get('categoria', 'Categoria', 'Categoría'),
                fechaAplicacion: get('fechaAplicacion'),
            } as NormalizedHealthRecord
        })
    }, [healthRecords]);

    const processedData = useMemo(() => {
        let filtered = normalizedHealthRecords;

        const groupedByApplication: { [key: string]: NormalizedHealthRecord & { cuarteles: string[] } } = {};
        filtered.forEach(record => {
            const date = record.fechaAplicacion;
            const product = record['producto'];
            const ingredient = record['ingredienteActivo'];
            const key = `${date}-${product}-${ingredient}`;

            if (!groupedByApplication[key]) {
                groupedByApplication[key] = { ...record, cuarteles: [] };
            }
            if (record['cuartel']) {
                groupedByApplication[key].cuarteles.push(record['cuartel']);
            }
        });
        
        const uniqueApplications = Object.values(groupedByApplication).map(record => ({
            ...record,
            cuarteles: [...new Set(record.cuarteles)].join(', '),
            parsedDate: parseCustomDate(record.fechaAplicacion)
        })).filter(r => r.parsedDate && isValid(r.parsedDate))
           .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());
        
        return uniqueApplications.map((record, index) => {
            let daysSinceLast = 'N/A';
            if (index > 0) {
                const prevDate = uniqueApplications[index - 1].parsedDate;
                if(prevDate && record.parsedDate) {
                  daysSinceLast = differenceInDays(record.parsedDate, prevDate).toString();
                }
            }
            return { ...record, daysSinceLast };
        }).reverse();

    }, [normalizedHealthRecords]);

    const handleDownload = () => {
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
                'Días Transcurridos': record.daysSinceLast,
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
    };
    
    useEffect(() => {
        setActions(
          <Button variant="ghost" size="icon" onClick={handleDownload} disabled={processedData.length === 0} className="h-9 w-9">
            <FileDown className="h-5 w-5" />
          </Button>
        );
        return () => setActions(null);
    }, [setActions, processedData, handleDownload]);

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
                                                        <TableCell>{record.parsedDate ? format(record.parsedDate, 'dd/MM/yyyy', { locale: es }) : 'Fecha Inválida'}</TableCell>
                                                        <TableCell>{ddc}</TableCell>
                                                        <TableCell>{record.lote}</TableCell>
                                                        <TableCell>{record.cuarteles}</TableCell>
                                                        <TableCell>{record['producto']}</TableCell>
                                                        <TableCell>{record['ingredienteActivo']}</TableCell>
                                                        <TableCell>{record.daysSinceLast}</TableCell>
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
