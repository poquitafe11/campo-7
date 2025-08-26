
'use client';

import React, { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMasterData } from '@/context/MasterDataContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { format, parse, isValid, differenceInDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Filter, Check, Calendar as CalendarIcon, Save } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { Calendar } from '@/components/ui/calendar';
import { getVisibleLotesSetting, saveVisibleLotesSetting } from './actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';


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

const normalizeLote = (lote: string) => {
    if (!lote || typeof lote !== 'string') return '';
    const numericPart = lote.trim().split('.')[0];
    return String(parseInt(numericPart, 10));
};

const parseHours = (timeString: string): number => {
    if (!timeString || typeof timeString !== 'string') return 0;
    const parts = timeString.split(':');
    if (parts.length < 2) return 0;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours + minutes / 60;
};

interface RecentIrrigationInfo {
  lote: string;
  daysSinceLastIrrigation: number | string;
  recentIrrigations: { date: string; hours: string }[];
}


export default function IrrigationSummaryPage() {
    const { toast } = useToast();
    const { profile } = useAuth();
    const { lotes: masterLotes, loading: masterLoading } = useMasterData();
    const { setActions } = useHeaderActions();
    const [irrigationRecords, setIrrigationRecords] = useState<IrrigationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, startSavingTransition] = useTransition();
    
    const [filters, setFilters] = useState<{ campaign: string; stage: string; lotes: string[] }>({
        campaign: '',
        stage: '',
        lotes: []
    });

    const [popoverFilters, setPopoverFilters] = useState(filters);
    const [loteSearch, setLoteSearch] = useState('');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    
    useEffect(() => {
        setActions({ title: "Resumen de Riego" });
        return () => setActions({});
    }, [setActions]);
    
    useEffect(() => {
        setLoading(true);

        const loadInitialView = async () => {
            const visibleLotes = await getVisibleLotesSetting();
            if (visibleLotes.length > 0) {
                const initialFilters = { campaign: '', stage: '', lotes: visibleLotes };
                setFilters(initialFilters);
                setPopoverFilters(initialFilters);
            }
        };

        loadInitialView();

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
    }, [toast, profile]);
    
    const filterOptions = useMemo(() => {
        const recordsForOptions = irrigationRecords;

        const campaigns = [...new Set(recordsForOptions.map(r => r['Campaña']))].filter(Boolean);
        const stages = [...new Set(recordsForOptions.map(r => r['Etapa']))].filter(Boolean);
        const lotes = [...new Set(recordsForOptions.map(r => r['Lote']))].filter(Boolean).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        return { campaigns, stages, lotes };
    }, [irrigationRecords]);


    const summaryData = useMemo(() => {
        let recordsToProcess = irrigationRecords;

        if (selectedDate) {
           recordsToProcess = recordsToProcess.filter(record => {
             const recordDate = parseSpanishDate(record.Fecha);
             return recordDate && isValid(recordDate) && recordDate <= selectedDate;
           });
        }
        
        let lotesForColumns: string[] = [];

        if (filters.lotes.length > 0) {
            lotesForColumns = filters.lotes;
        } else {
             lotesForColumns = [...new Set(recordsToProcess
                .filter(record => 
                    (!filters.campaign || record['Campaña'] === filters.campaign) &&
                    (!filters.stage || record['Etapa'] === filters.stage)
                )
                .map(r => r['Lote']))
            ].filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        }

        recordsToProcess = recordsToProcess.filter(record => 
            lotesForColumns.includes(record['Lote']) &&
            (!filters.campaign || record['Campaña'] === filters.campaign) &&
            (!filters.stage || record['Etapa'] === filters.stage)
        );
        
        if(lotesForColumns.length === 0) return null;


        const accumulated = recordsToProcess.reduce((acc, record) => {
            const lote = record['Lote'];
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

            return acc;
        }, {} as { [key: string]: any });

        const summaryColumns = lotesForColumns.map(lote => {
            const data = accumulated[lote] || { lote };
            const normalizedLoteNum = normalizeLote(lote);
            const loteMaster = masterLotes.find(l => normalizeLote(l.lote) === normalizedLoteNum);
            const fechaCianamida = loteMaster?.fechaCianamida;
            let ddc: number | string = 'N/A';
            
            if (selectedDate && fechaCianamida && isValid(fechaCianamida)) {
                ddc = differenceInDays(selectedDate, fechaCianamida);
            }

            return {
                lote,
                ddc,
                ...data,
            }
        });
        
        return {
            date: selectedDate ? format(selectedDate, 'P', { locale: es }) : 'N/A',
            columns: summaryColumns
        };

    }, [filters, irrigationRecords, masterLotes, selectedDate]);
    
    const recentIrrigationData = useMemo<RecentIrrigationInfo[]>(() => {
        const lotesToShow = summaryData?.columns.map(c => c.lote) || [];
        if (lotesToShow.length === 0) return [];
    
        return lotesToShow.map((lote) => {
            const loteRecords = irrigationRecords
                .filter(r => r['Lote'] === lote && r['Total Horas'] && parseHours(r['Total Horas']) > 0 && parseSpanishDate(r.Fecha))
                .map(r => ({...r, parsedDate: parseSpanishDate(r.Fecha)}))
                .filter(r => r.parsedDate && isValid(r.parsedDate))
                .sort((a, b) => b.parsedDate!.getTime() - a.parsedDate!.getTime());
    
            if (loteRecords.length === 0) {
                return {
                    lote,
                    daysSinceLastIrrigation: 'N/A',
                    recentIrrigations: Array(3).fill({ date: '-', hours: '-' }),
                };
            }
            
            const lastIrrigationDate = loteRecords[0].parsedDate!;
            const daysSince = selectedDate ? differenceInDays(selectedDate, lastIrrigationDate) : 'N/A';

            const recentIrrigations = Array(3).fill(null).map((_, i) => {
                if (loteRecords[i]) {
                    return {
                        date: format(loteRecords[i].parsedDate!, 'dd/MM'),
                        hours: loteRecords[i]['Total Horas'] || '00:00'
                    };
                }
                return { date: '-', hours: '-' };
            });
    
            return { lote, daysSinceLastIrrigation: daysSince, recentIrrigations };
        });
    
    }, [summaryData, irrigationRecords, selectedDate]);

    const lavadoIrrigationData = useMemo<RecentIrrigationInfo[]>(() => {
        const lotesToShow = summaryData?.columns.map(c => c.lote) || [];
        if (lotesToShow.length === 0) return [];
    
        return lotesToShow.map((lote) => {
            const lavadoRecords = irrigationRecords
                .filter(r => r['Lote'] === lote && r['Total Horas'] && parseHours(r['Total Horas']) >= 8 && parseSpanishDate(r.Fecha))
                .map(r => ({...r, parsedDate: parseSpanishDate(r.Fecha)}))
                .filter(r => r.parsedDate && isValid(r.parsedDate))
                .sort((a, b) => b.parsedDate!.getTime() - a.parsedDate!.getTime());
    
            if (lavadoRecords.length === 0) {
                return {
                    lote,
                    daysSinceLastIrrigation: 'N/A',
                    recentIrrigations: Array(3).fill({ date: '-', hours: '-' }),
                };
            }
            
            const lastLavadoDate = lavadoRecords[0].parsedDate!;
            const daysSince = selectedDate ? differenceInDays(selectedDate, lastLavadoDate) : 'N/A';

            const recentLavados = Array(3).fill(null).map((_, i) => {
                if (lavadoRecords[i]) {
                    return {
                        date: format(lavadoRecords[i].parsedDate!, 'dd/MM'),
                        hours: lavadoRecords[i]['Total Horas'] || '00:00'
                    };
                }
                return { date: '-', hours: '-' };
            });
    
            return { lote, daysSinceLastIrrigation: daysSince, recentIrrigations: recentLavados };
        });
    }, [summaryData, irrigationRecords, selectedDate]);


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
    
    const handleSaveView = () => {
        startSavingTransition(async () => {
            const result = await saveVisibleLotesSetting(filters.lotes);
            if(result.success) {
                toast({ title: "Vista Guardada", description: "La selección de lotes ha sido guardada para los demás usuarios." });
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        });
    };

    const searchedLotes = useMemo(() => {
        return filterOptions.lotes.filter(l => l.toLowerCase().includes(loteSearch.toLowerCase()));
    }, [filterOptions.lotes, loteSearch]);

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Unidades Acumuladas</CardTitle>
                        <div className="flex items-center gap-2">
                            {profile?.rol === 'Admin' && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="icon"><CalendarIcon className="h-4 w-4" /></Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <Calendar
                                            mode="single"
                                            selected={selectedDate}
                                            onSelect={setSelectedDate}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
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
                                            <Input 
                                                placeholder="Buscar lote..." 
                                                value={loteSearch} 
                                                onChange={(e) => setLoteSearch(e.target.value)}
                                            />
                                            <ScrollArea className="h-[150px] border rounded-md">
                                                <div className="p-2 space-y-1">
                                                    {searchedLotes.map(lote => (
                                                        <div key={lote} onClick={() => toggleLoteSelection(lote)} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted">
                                                            <Checkbox
                                                                id={`lote-${lote}`}
                                                                checked={popoverFilters.lotes.includes(lote)}
                                                            />
                                                            <Label htmlFor={`lote-${lote}`} className="cursor-pointer w-full text-sm font-normal">
                                                                {lote}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                            <div className="flex flex-wrap gap-1">
                                                {popoverFilters.lotes.map(lote => <Badge key={lote} variant="secondary">{lote}</Badge>)}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            {profile?.rol === 'Admin' && (
                                                <Button variant="outline" size="sm" onClick={handleSaveView} disabled={isSaving}>
                                                   {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                                   Guardar Vista
                                                </Button>
                                            )}
                                            <div className="flex-grow"></div>
                                            <Button onClick={handleApplyFilters}>Aplicar</Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
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

            {isContentReady && recentIrrigationData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Riegos Recientes</CardTitle>
                        <CardDescription>Detalle de las últimas 3 aplicaciones de riego para los lotes seleccionados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-bold py-2 px-3">Lote</TableHead>
                                        <TableHead className="font-bold text-center py-2 px-3">Días sin Riego</TableHead>
                                        <TableHead className="text-center py-2 px-3">Riego 1 (Reciente)</TableHead>
                                        <TableHead className="text-center py-2 px-3">Riego 2</TableHead>
                                        <TableHead className="text-center py-2 px-3">Riego 3</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentIrrigationData.map((data, index) => (
                                        <TableRow key={`${data.lote}-${index}`}>
                                            <TableCell className="font-semibold py-2 px-3">{data.lote}</TableCell>
                                            <TableCell className="text-center py-2 px-3">{data.daysSinceLastIrrigation}</TableCell>
                                            {data.recentIrrigations.map((irrigation, i) => (
                                                 <TableCell key={i} className="text-center py-2 px-3">
                                                    <div>{irrigation.date}</div>
                                                    <div className="text-xs text-muted-foreground">{irrigation.hours}</div>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isContentReady && lavadoIrrigationData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Riego de Lavado</CardTitle>
                        <CardDescription>Detalle de los últimos 3 riegos de 8 horas a más.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-bold py-2 px-3">Lote</TableHead>
                                        <TableHead className="font-bold text-center py-2 px-3">Días sin Lavado</TableHead>
                                        <TableHead className="text-center py-2 px-3">Lavado 1 (Reciente)</TableHead>
                                        <TableHead className="text-center py-2 px-3">Lavado 2</TableHead>
                                        <TableHead className="text-center py-2 px-3">Lavado 3</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lavadoIrrigationData.map((data, index) => {
                                        const daysSince = data.daysSinceLastIrrigation;
                                        const needsAttention = typeof daysSince === 'number' && daysSince >= 15;
                                        return (
                                            <TableRow key={`${data.lote}-${index}`}>
                                                <TableCell className="font-semibold py-2 px-3">{data.lote}</TableCell>
                                                <TableCell className={cn(
                                                    "text-center py-2 px-3",
                                                    needsAttention && "bg-red-200 text-red-900 font-bold"
                                                )}>
                                                    {daysSince}
                                                </TableCell>
                                                {data.recentIrrigations.map((irrigation, i) => (
                                                     <TableCell key={i} className="text-center py-2 px-3">
                                                        <div>{irrigation.date}</div>
                                                        <div className="text-xs text-muted-foreground">{irrigation.hours}</div>
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
