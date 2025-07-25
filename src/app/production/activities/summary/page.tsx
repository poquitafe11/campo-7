
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { ActivityRecordData, LoteData, MinMax } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Filter, RefreshCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useMasterData } from '@/context/MasterDataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, ComposedChart, ResponsiveContainer, LabelList } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';


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

const chartConfig = {
  jhu: {
    label: "JHU",
    color: "hsl(var(--chart-1))",
  },
  promedio: {
    label: "Promedio",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export default function ActivitySummaryPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [allActivities, setAllActivities] = useState<ActivityRecordData[]>([]);
    const { lotes: allLotes, labors: allLabors, minMax: allMinMax, loading: masterLoading, refreshData: refreshMasterData } = useMasterData();
    
    const [activeFilters, setActiveFilters] = useState<Filters>(getInitialFilters());
    const [popoverFilters, setPopoverFilters] = useState<Filters>(getInitialFilters());
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const loadData = useCallback(async (showToast = false) => {
        setIsLoading(true);
        try {
            const activitiesSnapshot = await getDocs(collection(db, 'actividades'));

            const activitiesData = activitiesSnapshot.docs.map(doc => {
                const data = doc.data();
                const registerDate = data.registerDate?.toDate ? data.registerDate.toDate() : new Date();
                return { ...data, registerDate } as ActivityRecordData;
            });
            setAllActivities(activitiesData);
            
            await refreshMasterData();

            if(showToast) {
                toast({ title: "Éxito", description: "Los datos del resumen han sido actualizados." });
            }

        } catch (error) {
            console.error("Error loading summary data:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos para el resumen." });
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshMasterData]);

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        
        const cuartelesDelLote = allLotes.filter(l => l.lote === activeFilters.lote);
        if (cuartelesDelLote.length === 0) return null;

        const haProd = cuartelesDelLote.reduce((sum, cuartel) => sum + (cuartel.haProd || 0), 0);
        const densidad = cuartelesDelLote[0]?.densidad ?? 0;
        
        const groupedByDate: { [date: string]: ActivityRecordData[] } = {};
        for (const activity of filteredActivities) {
            const dateKey = format(activity.registerDate, 'yyyy-MM-dd');
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = [];
            }
            groupedByDate[dateKey].push(activity);
        }
        
        const dailyData = Object.entries(groupedByDate).map(([dateStr, activitiesOnDate]) => {
            const personas = activitiesOnDate.reduce((sum, act) => sum + act.personnelCount, 0);
            const jhu = activitiesOnDate.reduce((sum, act) => sum + act.workdayCount, 0);
            const plantas = activitiesOnDate.reduce((sum, act) => sum + (act.performance || 0), 0);
            
            const promedio = jhu > 0 ? plantas / jhu : 0;
            const plantasHora = jhu > 0 ? plantas / (jhu * 8) : 0;
            const hasDia = densidad > 0 ? plantas / densidad : 0;
            
            const avanceDia = haProd > 0 ? (hasDia / haProd) * 100 : 0;

            const minRange = Math.min(...activitiesOnDate.map(a => a.minRange || 0));
            const maxRange = Math.max(...activitiesOnDate.map(a => a.maxRange || 0));

            return {
                date: parseISO(dateStr),
                hasDia,
                summaryData: {
                    lote: activeFilters.lote,
                    pasada: Number(activeFilters.pasada) || 0,
                    fecha: format(parseISO(dateStr), 'dd-MMM', { locale: es }),
                    personas,
                    plantas,
                    jhu,
                    promedio,
                    plantasHora: Math.round(plantasHora),
                    has: Number(hasDia.toFixed(2)),
                    avance: `${Math.round(avanceDia)}%`,
                    haPorTrabajar: 0, 
                    minimo: minRange,
                    maximo: maxRange,
                }
            };
        }).sort((a, b) => a.date.getTime() - b.date.getTime());

        let cumulativeHas = 0;
        const summariesWithCumulative = dailyData.map(day => {
            cumulativeHas += day.hasDia;
            const haPorTrabajar = haProd - cumulativeHas;
            
            return {
                summary: {
                    ...day.summaryData,
                    haPorTrabajar: Number(haPorTrabajar.toFixed(2))
                },
                date: day.date
            };
        });

        return summariesWithCumulative.sort((a, b) => b.date.getTime() - a.date.getTime());

    }, [allActivities, allLotes, activeFilters]);

    const minMaxData = useMemo(() => {
        if (!activeFilters.campaign || !activeFilters.lote || !activeFilters.labor || !activeFilters.pasada || masterLoading) {
            return { min: 'N/A', max: 'N/A' };
        }
        
        const foundMinMax = allMinMax.find(item =>
            item.campana === activeFilters.campaign &&
            item.lote === activeFilters.lote &&
            item.labor === activeFilters.labor &&
            String(item.pasada) === activeFilters.pasada
        );

        if (foundMinMax) {
            return { min: foundMinMax.min, max: foundMinMax.max };
        }

        return { min: 'N/A', max: 'N/A' };
    }, [activeFilters, allMinMax, masterLoading]);


    const summaryRows: { label: string | React.ReactNode; key: keyof SummaryValues; bgClass?: string, format?: (val: any) => string | number }[] = [
        { label: "N° PERSONAS", key: "personas" },
        { label: "PLANTAS", key: "plantas", format: (v) => v.toLocaleString('es-ES') },
        { label: "JHU", key: "jhu", format: (v) => v.toFixed(2) },
        { label: "PROMEDIO", key: "promedio", format: (v) => Math.round(v) },
        { label: "Pltas./ Hora", key: "plantasHora", bgClass: "bg-[#f8cbad]" },
        { label: "Has.", key: "has" },
        { label: "% Avance", key: "avance" },
        { label: "Ha por Trabajar", key: "haPorTrabajar" },
        { label: "MINIMO", key: "minimo" },
        { label: "MAXIMO", key: "maximo" },
    ];
    
    const loading = isLoading || masterLoading;

    const chartData = useMemo(() => {
        if (!multiDaySummary) return [];
        return multiDaySummary
            .map(d => ({
                fecha: d.summary.fecha,
                jhu: d.summary.jhu,
                promedio: Math.round(d.summary.promedio),
            }))
            .reverse(); 
    }, [multiDaySummary]);


    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <PageHeaderWithNav 
                title="Resumen de Actividades"
                extraButton={
                    <Button variant="outline" size="icon" onClick={() => loadData(true)} disabled={isLoading}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    </Button>
                }
            />
            
            <div className="space-y-4">
                <div className="flex items-center justify-end gap-2">
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

                {loading ? (
                    <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : multiDaySummary && multiDaySummary.length > 0 ? (
                    <div className="space-y-4">
                        <div className="max-w-md">
                            <table data-internal-id="cuadro-1" className="border-collapse border border-black text-xs">
                                <thead className="text-left font-bold text-black">
                                    <tr>
                                        <th colSpan={2} className="border border-black bg-gray-200 p-2 text-base font-bold h-10 align-middle">
                                            LABOR: {(activeFilters.labor || 'N/A').toUpperCase()}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    <tr>
                                        <td className="border border-black px-2 py-1 font-bold">LOTE: {activeFilters.lote || 'N/A'}</td>
                                        <td className="border border-black px-2 py-1 font-bold">MIN. ESTAB.: {minMaxData?.min ?? 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black px-2 py-1 font-bold">PASADA: {activeFilters.pasada || 'N/A'}</td>
                                        <td className="border border-black px-2 py-1 font-bold">MAX. ESTAB.: {minMaxData?.max ?? 'N/A'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="overflow-x-auto pb-4">
                            <table data-internal-id="cuadro-2" className="border-collapse border border-black text-xs min-w-full">
                                <thead className="text-center font-bold text-black">
                                    <tr className="bg-gray-300">
                                        <td className="border border-black px-4 py-2 font-bold w-36">FECHA</td>
                                        {multiDaySummary.map((day, index) => <td key={index} className="border border-black px-4 py-2 text-center font-bold">{day.summary.fecha}</td>)}
                                    </tr>
                                </thead>
                                <tbody className="bg-[#dbe5f1]">
                                    {summaryRows.map(row => (
                                        <tr key={String(row.key)}>
                                            <td className={`border border-black px-4 py-2 font-bold w-36 ${row.bgClass || ''}`}>{row.label}</td>
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
                        <Card>
                            <CardHeader>
                                <CardTitle>Gráfico de Jornadas y Promedio</CardTitle>
                                <CardDescription>
                                    Visualización de las jornadas (JHU) y el promedio de rendimiento por día.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                                    <ComposedChart data={chartData}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="fecha" tickLine={false} axisLine={false} tickMargin={8} />
                                        <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--chart-1))" />
                                        <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-2))" />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Legend />
                                        <Bar dataKey="jhu" yAxisId="left" fill="var(--color-jhu)" radius={4}>
                                            <LabelList dataKey="jhu" position="top" offset={4} className="fill-foreground" fontSize={10} />
                                        </Bar>
                                        <Line type="monotone" dataKey="promedio" yAxisId="right" stroke="var(--color-promedio)" strokeWidth={2} dot={{ fill: "var(--color-promedio)" }}>
                                            <LabelList dataKey="promedio" position="top" offset={4} className="fill-foreground" fontSize={10} />
                                        </Line>
                                    </ComposedChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
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
