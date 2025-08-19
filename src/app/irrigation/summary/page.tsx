
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { useMasterData } from '@/context/MasterDataContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { format, parse, isValid, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Filter, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type IrrigationRecord = { [key: string]: any; id: string; };

const NUTRIENTS = ['N', 'P2O5', 'K', 'Ca', 'Mg', 'Zn', 'Mn'];

// Function to parse Spanish dates like "15 de Julio de 2025"
const parseSpanishDate = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    const months: { [key: string]: number } = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };
    const parts = dateString.toLowerCase().split(' de ');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = months[parts[1]];
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
            return new Date(year, month, day);
        }
    }
    const parsed = parse(dateString, "d/M/yyyy", new Date());
    if(isValid(parsed)) return parsed;
    return null;
};


export default function IrrigationSummaryPage() {
    const { toast } = useToast();
    const { lotes: masterLotes, loading: masterLoading } = useMasterData();
    const [irrigationRecords, setIrrigationRecords] = useState<IrrigationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [filters, setFilters] = useState<{ campaign: string; stage: string; lotes: string[] }>({
        campaign: '',
        stage: '',
        lotes: []
    });

    const [popoverFilters, setPopoverFilters] = useState(filters);
    
    useEffect(() => {
        setLoading(true);
        const unsubscribe = onSnapshot(collection(db, "registros-riego"), (snapshot) => {
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IrrigationRecord));
            setIrrigationRecords(records);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching irrigation records: ", error);
            toast({ variant: "destructive", title: "Error de Carga", description: "No se pudieron cargar los registros de riego." });
            setLoading(false);
        });
        return () => unsubscribe();
    }, [toast]);
    
    const filterOptions = useMemo(() => {
        const campaigns = [...new Set(irrigationRecords.map(r => r['Campaña']))].filter(Boolean);
        const stages = [...new Set(irrigationRecords.map(r => r['Etapa']))].filter(Boolean);
        const lotes = [...new Set(masterLotes.map(l => l.lote))].filter(Boolean).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        return { campaigns, stages, lotes };
    }, [irrigationRecords, masterLotes]);


    const summaryData = useMemo(() => {
        const recordsToProcess = irrigationRecords.filter(record => 
            (!filters.campaign || record['Campaña'] === filters.campaign) &&
            (!filters.stage || record['Etapa'] === filters.stage) &&
            (filters.lotes.length === 0 || filters.lotes.includes(record['Lote']))
        );
        
        if (recordsToProcess.length === 0 && filters.lotes.length > 0) { // Show message only if filters are active and there are no results
            return null;
        }

        const lotesForColumns = filters.lotes.length > 0
            ? filters.lotes
            : [...new Set(recordsToProcess.map(r => r['Lote']))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (lotesForColumns.length === 0) {
             return null; // Return null if there are no lots to display columns for.
        }

        let latestDate: Date | null = null;
        
        const accumulated = recordsToProcess.reduce((acc, record) => {
            const lote = record['Lote'];
            if (!lotesForColumns.includes(lote)) return acc;

            if (!acc[lote]) {
                acc[lote] = { lote: lote };
                NUTRIENTS.forEach(n => acc[lote][n] = 0);
            }
            NUTRIENTS.forEach(nutrient => {
                const value = parseFloat(String(record[nutrient] ?? '0').replace(',', '.'));
                if (!isNaN(value)) {
                    acc[lote][nutrient] += value;
                }
            });

            const recordDate = parseSpanishDate(record.Fecha);
            if (recordDate && isValid(recordDate)) {
                if (!latestDate || recordDate > latestDate) {
                    latestDate = recordDate;
                }
            }
            return acc;
        }, {} as { [key: string]: any });

        const summaryColumns = lotesForColumns.map(lote => {
            const data = accumulated[lote] || { lote };
            const loteMaster = masterLotes.find(l => l.lote === lote);
            const fechaCianamida = loteMaster?.fechaCianamida ? (loteMaster.fechaCianamida instanceof Date ? loteMaster.fechaCianamida : parseSpanishDate(loteMaster.fechaCianamida as string)) : null;
            let ddc = 'N/A';
            if (latestDate && fechaCianamida && isValid(fechaCianamida)) {
                ddc = differenceInDays(latestDate, fechaCianamida).toString();
            }
            return {
                lote,
                ddc,
                ...data,
            }
        });
        
        return {
            date: latestDate ? format(latestDate, 'P', { locale: es }) : 'N/A',
            columns: summaryColumns
        };

    }, [filters, irrigationRecords, masterLotes]);

    const handleApplyFilters = () => {
        setFilters(popoverFilters);
    };

    const isContentReady = !loading && !masterLoading;
    
    const toggleLoteSelection = (lote: string) => {
        setPopoverFilters(prev => {
            const newLotes = prev.lotes.includes(lote)
                ? prev.lotes.filter(s => s !== lote)
                : [...prev.lotes, lote];
            return { ...prev, lotes: newLotes.sort((a,b) => a.localeCompare(b, undefined, {numeric: true})) };
        });
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Resumen de Riego" />
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Unidades Acumuladas</CardTitle>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4"/>Filtros</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <div className="grid gap-4">
                                    <h4 className="font-medium leading-none">Filtros</h4>
                                    <div className="grid gap-2">
                                        <Label>Campaña</Label>
                                        <Select value={popoverFilters.campaign} onValueChange={v => setPopoverFilters(p => ({...p, campaign: v}))}><SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger><SelectContent>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Etapa</Label>
                                        <Select value={popoverFilters.stage} onValueChange={v => setPopoverFilters(p => ({...p, stage: v}))}><SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger><SelectContent>{filterOptions.stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Lotes</Label>
                                        <Command className="rounded-lg border shadow-md"><CommandInput placeholder="Buscar lote..."/>
                                            <CommandList>
                                                <CommandEmpty>No se encontraron lotes.</CommandEmpty>
                                                <CommandGroup>
                                                    {filterOptions.lotes.map(lote => (
                                                        <CommandItem 
                                                            key={lote} 
                                                            value={lote}
                                                            onSelect={() => toggleLoteSelection(lote)}
                                                            className="cursor-pointer"
                                                        >
                                                            <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", popoverFilters.lotes.includes(lote) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}><Check className={cn("h-4 w-4")}/></div>
                                                            {lote}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                        <div className="flex flex-wrap gap-1">
                                            {popoverFilters.lotes.map(lote => <Badge key={lote} variant="secondary">{lote}</Badge>)}
                                        </div>
                                    </div>
                                    <Button onClick={handleApplyFilters}>Aplicar</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>
                <CardContent>
                    {!isContentReady ? (
                        <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : !summaryData || summaryData.columns.length === 0 ? (
                         <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground text-center">
                                {filters.lotes.length > 0 || filters.campaign || filters.stage ? "No se encontraron datos para los filtros seleccionados." : "No hay datos de riego para mostrar."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-blue-100">
                                        <th className="border p-2 text-left font-semibold" colSpan={summaryData.columns.length + 1}>
                                            Unds Acumulado hasta: {summaryData.date}
                                        </th>
                                    </tr>
                                    <tr>
                                        <th className="border p-2 bg-lime-400 font-semibold">DDC</th>
                                        {summaryData.columns.map(({lote, ddc}) => (
                                            <th key={lote} className="border p-2 bg-lime-400 font-semibold">{ddc}</th>
                                        ))}
                                    </tr>
                                     <tr>
                                        <th className="border p-2 bg-blue-200 font-semibold">Lote</th>
                                        {summaryData.columns.map(({lote}) => (
                                            <th key={lote} className="border p-2 bg-blue-200 font-semibold">{lote}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {NUTRIENTS.map(nutrient => (
                                        <tr key={nutrient}>
                                            <th className="border p-2 bg-blue-200 font-semibold text-left">{nutrient}</th>
                                            {summaryData.columns.map(({lote, ...data}) => (
                                                <td key={`${lote}-${nutrient}`} className="border p-2 text-center">
                                                    {(data[nutrient] || 0).toFixed(1)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
    

    