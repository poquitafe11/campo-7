
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { ActivityRecordData, LoteData, Labor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface SummaryValues {
    lote: string;
    pasada: number;
    fecha: string;
    personas: number;
    plantas: number;
    jhu: number;
    promedio: number;
    plantasHora: number;
    has: number;
    avance: string;
    haPorTrabajar: number;
    minimo: number;
    maximo: number;
}

interface Filters {
    campaign: string;
    lote: string;
    labor: string;
    pasada: string;
}

const getInitialFilters = (): Filters => ({ campaign: '', lote: '', labor: '', pasada: '' });

export default function ActivitySummaryPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [allActivities, setAllActivities] = useState<ActivityRecordData[]>([]);
    const [allLotes, setAllLotes] = useState<LoteData[]>([]);
    const [allLabors, setAllLabors] = useState<Labor[]>([]);
    
    const [activeFilters, setActiveFilters] = useState<Filters>(getInitialFilters());
    const [popoverFilters, setPopoverFilters] = useState<Filters>(getInitialFilters());
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [activitiesSnapshot, lotesSnapshot, laborsSnapshot] = await Promise.all([
                getDocs(collection(db, 'actividades')),
                getDocs(collection(db, 'maestro-lotes')),
                getDocs(collection(db, 'maestro-labores')),
            ]);

            const activitiesData = activitiesSnapshot.docs.map(doc => {
                const data = doc.data();
                const registerDate = data.registerDate?.toDate ? data.registerDate.toDate() : new Date();
                return { ...data, registerDate } as ActivityRecordData;
            });
            setAllActivities(activitiesData);

            const lotesData = lotesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as LoteData);
            setAllLotes(lotesData);

            const laborsData = laborsSnapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() }) as Labor);
            setAllLabors(laborsData);

        } catch (error) {
            console.error("Error loading summary data:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos para el resumen." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filterOptions = useMemo(() => {
        const campaigns = [...new Set(allActivities.map(a => a.campaign))].sort();
        const lotes = [...new Set(allActivities.map(a => a.lote))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        const labors = [...new Set(allActivities.map(a => a.labor).filter(Boolean) as string[])].sort();
        const pasadas = [...new Set(allActivities.map(a => String(a.pass)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        return { campaigns, lotes, labors, pasadas };
    }, [allActivities]);


    const handlePopoverFilterChange = (filterName: keyof Filters, value: string) => {
        setPopoverFilters(prev => ({ ...prev, [filterName]: value === 'all' ? '' : value }));
    };

    const handleApplyFilters = () => {
        setActiveFilters(popoverFilters);
        setIsFilterOpen(false);
    };

    const handleClearFilters = () => {
        const cleared = getInitialFilters();
        setPopoverFilters(cleared);
        setActiveFilters(cleared);
        setIsFilterOpen(false);
    };

    const multiDaySummary = useMemo<{ summary: SummaryValues; date: Date }[] | null>(() => {
        if (!activeFilters.lote || !activeFilters.labor) return null;

        const filteredActivities = allActivities.filter(a => {
            const campaignMatch = activeFilters.campaign ? a.campaign === activeFilters.campaign : true;
            const pasadaMatch = activeFilters.pasada ? String(a.pass) === activeFilters.pasada : true;
            return campaignMatch &&
                   a.lote === activeFilters.lote &&
                   a.labor === activeFilters.labor &&
                   pasadaMatch;
        });

        if (filteredActivities.length === 0) return null;

        const groupedByDate: { [date: string]: ActivityRecordData[] } = {};
        for (const activity of filteredActivities) {
            const dateKey = format(activity.registerDate, 'yyyy-MM-dd');
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = [];
            }
            groupedByDate[dateKey].push(activity);
        }
        
        const summaries = Object.entries(groupedByDate).map(([dateStr, activitiesOnDate]) => {
            const loteInfo = allLotes.find(l => l.lote === activeFilters.lote);
            const personas = activitiesOnDate.reduce((sum, act) => sum + act.personnelCount, 0);
            const jhu = activitiesOnDate.reduce((sum, act) => sum + act.workdayCount, 0);
            const has = loteInfo?.ha || 0;
            const plantas = loteInfo?.plantasTotal || 0;

            const promedio = personas > 0 ? jhu / personas : 0;
            const plantasHora = jhu > 0 ? plantas / (jhu * 8) : 0; // Assuming 8 hours per workday

            const avance = has > 0 ? ((jhu * 0.1) / has) * 100 : 0;
            const haPorTrabajar = has - (jhu * 0.1);
            const minPerf = Math.min(...activitiesOnDate.map(a => a.performance));
            const maxPerf = Math.max(...activitiesOnDate.map(a => a.performance));
            
            const summary: SummaryValues = {
                lote: activeFilters.lote,
                pasada: Number(activeFilters.pasada) || 0,
                fecha: format(parseISO(dateStr), 'dd-MMM', { locale: es }),
                personas,
                plantas: loteInfo?.plantasTotal ?? 0,
                jhu,
                promedio,
                plantasHora: Math.round(plantasHora),
                has: loteInfo?.ha ?? 0,
                avance: `${avance.toFixed(0)}%`,
                haPorTrabajar: Number(haPorTrabajar.toFixed(2)),
                minimo: minPerf === Infinity ? 0 : minPerf,
                maximo: maxPerf === -Infinity ? 0 : maxPerf,
            };
            return { summary, date: parseISO(dateStr) };
        });

        return summaries.sort((a, b) => b.date.getTime() - a.date.getTime());

    }, [allActivities, allLotes, activeFilters]);

    const tableTitle = useMemo(() => {
        const labor = allLabors.find(l => l.descripcion === activeFilters.labor);
        const lote = allLotes.find(l => l.lote === activeFilters.lote);
        if (!labor || !lote) return "Resumen de Actividad";
        
        const variedad = lote.variedad || 'N/A';
        const variedadAbreviada = variedad.split(' ').map(w => w.substring(0,1)).join('').toUpperCase();

        return `${labor.descripcion.toUpperCase()} ${variedadAbreviada}`;

    }, [activeFilters, allLabors, allLotes]);

    const summaryRows: { label: string | React.ReactNode; key: keyof SummaryValues; bgClass?: string, format?: (val: any) => string | number }[] = [
        { label: "FECHA", key: "fecha" },
        { label: "N° PERSONAS", key: "personas" },
        { label: "PLANTAS", key: "plantas", format: (v) => v.toLocaleString('es-ES') },
        { label: "JHU", key: "jhu", format: (v) => v.toFixed(2) },
        { label: "PROMEDIO", key: "promedio", format: (v) => v.toFixed(0) },
        { label: "Pltas./ Hora", key: "plantasHora", bgClass: "bg-[#f8cbad]" },
        { label: "Has.", key: "has" },
        { label: "% Avance", key: "avance" },
        { label: "Ha por Trabajar", key: "haPorTrabajar" },
        { label: "MINIMO", key: "minimo" },
        { label: "MAXIMO", key: "maximo" },
    ];


    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <PageHeaderWithNav title="Resumen de Actividades" />
            
            <div className="space-y-4">
                <div className="flex justify-end">
                    <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-sm">
                                <Filter className="mr-2 h-4 w-4" />
                                Filtros
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Aplicar Filtros</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Selecciona los criterios para el resumen.
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>Campaña</Label>
                                        <Select onValueChange={(v) => handlePopoverFilterChange('campaign', v)} value={popoverFilters.campaign}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Campaña" /></SelectTrigger><SelectContent>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>Lote</Label>
                                        <Select onValueChange={(v) => handlePopoverFilterChange('lote', v)} value={popoverFilters.lote}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Lote" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>Labor</Label>
                                        <Select onValueChange={(v) => handlePopoverFilterChange('labor', v)} value={popoverFilters.labor}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Labor" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>Pasada</Label>
                                        <Select onValueChange={(v) => handlePopoverFilterChange('pasada', v)} value={popoverFilters.pasada}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Pasada" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.pasadas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>Limpiar</Button>
                                    <Button size="sm" onClick={handleApplyFilters}>Aplicar</Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {isLoading ? (
                    <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : multiDaySummary && multiDaySummary.length > 0 ? (
                    <div className="overflow-x-auto pb-4">
                       <div className="inline-block min-w-full">
                           <table className="border-collapse border border-black text-xs">
                                <thead>
                                    <tr>
                                        <th colSpan={1 + multiDaySummary.length} className="border border-black bg-gray-200 p-2 text-base font-bold text-center h-14 align-middle">
                                            {tableTitle}
                                        </th>
                                    </tr>
                                    <tr className="bg-gray-300">
                                        <td className="border border-black px-4 py-2 font-bold">Lote</td>
                                        {multiDaySummary.map((day, index) => <td key={index} className="border border-black px-4 py-2 text-center font-bold">{day.summary.lote}</td>)}
                                    </tr>
                                    <tr className="bg-gray-300">
                                        <td className="border border-black px-4 py-2 font-bold"><span className="italic">Pasada</span></td>
                                        {multiDaySummary.map((day, index) => <td key={index} className="border border-black px-4 py-2 text-center font-bold">{day.summary.pasada}</td>)}
                                    </tr>
                                </thead>
                                <tbody className="bg-[#dbe5f1]">
                                    {summaryRows.map(row => (
                                        <tr key={String(row.key)}>
                                            <td className={`border border-black px-4 py-2 font-bold ${row.bgClass || ''}`}>{row.label}</td>
                                            {multiDaySummary.map((day, index) => {
                                                const value = day.summary[row.key];
                                                return (
                                                    <td key={index} className={`border border-black px-4 py-2 text-center ${row.bgClass || ''}`}>
                                                        {row.format ? row.format(value) : value}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-64 items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <p>Seleccione los filtros para ver un resumen.<br />Asegúrese de elegir al menos un Lote y una Labor.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

