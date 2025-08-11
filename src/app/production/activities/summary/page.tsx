
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Filter, RefreshCcw, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { type ActivityRecordData, type LoteData, type MinMax } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useMasterData } from '@/context/MasterDataContext';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/PageHeader';

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

const formatNumber = (num: number, digits = 2) => {
  if (isNaN(num) || !isFinite(num)) {
    return '0.00';
  }
  return num.toLocaleString('es-PE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export default function ActivitySummaryPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [allActivities, setAllActivities] = useState<ActivityRecordData[]>([]);
    const { lotes: allLotes, labors: allLabors, minMax: allMinMax, campaigns: allCampaigns, loading: masterLoading, refreshData: refreshMasterData } = useMasterData();
    
    const [activeFilters, setActiveFilters] = useState({ campaign: '', lote: '', labor: '', pasada: '' });
    const [popoverFilters, setPopoverFilters] = useState({ campaign: '', lote: '', labor: '', pasada: '' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const { setActions } = useHeaderActions();

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

    const multiDaySummary = useMemo<{ summary: SummaryValues; date: Date }[] | null>(() => {
        const filteredActivities = allActivities.filter(a => 
            (!activeFilters.campaign || a.campaign === activeFilters.campaign) &&
            (!activeFilters.lote || a.lote === activeFilters.lote) && 
            a.labor === activeFilters.labor &&
            String(a.pass) === activeFilters.pasada
        );

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

            const relevantActivities = activitiesOnDate;

            const minRange = relevantActivities.length > 0 ? Math.min(...relevantActivities.map(a => a.minRange || 0)) : 0;
            const maxRange = relevantActivities.length > 0 ? Math.max(...relevantActivities.map(a => a.maxRange || 0)) : 0;

            return {
                date: parseISO(dateStr),
                hasDia,
                summaryData: {
                    lote: activeFilters.lote,
                    pasada: parseInt(activeFilters.pasada, 10),
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
        if (!activeFilters.lote || !activeFilters.labor || !activeFilters.pasada || masterLoading) {
            return { min: 'N/A', max: 'N/A' };
        }
        
        const foundMinMax = allMinMax.find(item =>
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
    
    const filterOptions = useMemo(() => { // filterOptions.campaigns is already available from useMasterData
        const lotes = [...new Set(allActivities.map(a => a.lote))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        const labors = [...new Set(allActivities.map(a => a.labor).filter(Boolean) as string[])].sort();
        const pasadas = [...new Set(allActivities.map(a => String(a.pass)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        return { lotes, labors, pasadas };
    }, [allActivities]);
    
    const handleApplyFilters = useCallback(() => {
        setActiveFilters(popoverFilters);
        setIsFilterOpen(false);
    }, [popoverFilters]);

    useEffect(() => {
        setActions(
            <>
                <Button variant="ghost" size="icon" onClick={() => loadData(true)} disabled={loading} className="h-9 w-9">
                    <RefreshCcw className="h-5 w-5" />
                </Button>
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-9 w-9">
                            <Filter className="h-5 w-5" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                       <div className="grid gap-4">
                           <div className="space-y-2"><h4 className="font-medium leading-none">Filtros de Resumen</h4></div>
                           <div className="grid gap-2">
                                <Label>Lote</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, lote: v === 'all' ? '' : v }))} value={popoverFilters.lote}>
                                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Label>Labor</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, labor: v === 'all' ? '' : v }))} value={popoverFilters.labor}>
                                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {filterOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Label>Pasada</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, pasada: v === 'all' ? '' : v }))} value={popoverFilters.pasada}>
                                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {filterOptions.pasadas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                           </div>
                           <div className="flex justify-end pt-2">
                                <Button size="sm" onClick={handleApplyFilters}>Aplicar</Button>
                           </div>
                       </div>
                    </PopoverContent>
                </Popover>
            </>
        );
        return () => setActions(null);
    }, [setActions, isFilterOpen, popoverFilters, filterOptions, loading, handleApplyFilters]);


    return (
        <div className="w-full">
             {loading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : multiDaySummary && multiDaySummary.length > 0 ? (
                <div className="space-y-4">
                    <div className="inline-block">
                          <table className="border-collapse border border-black text-[10px]">
                              <thead className="text-left font-bold text-black">
                                  <tr>
                                      <th colSpan={2} className="border border-black bg-gray-200 p-0.5 text-xs font-bold h-6 align-middle whitespace-nowrap">
                                          LABOR: {(activeFilters.labor || 'N/A').toUpperCase()}
                                      </th>
                                  </tr>
                              </thead>
                              <tbody className="bg-white">
                                  <tr>
                                      <td className="border border-black px-1 py-0.5 font-bold whitespace-nowrap">LOTE: {activeFilters.lote || 'N/A'}</td>
                                      <td className="border border-black px-1 py-0.5 font-bold whitespace-nowrap">MIN. ESTAB.: {minMaxData?.min ?? 'N/A'}</td>
                                  </tr>
                                  <tr>
                                      <td className="border border-black px-1 py-0.5 font-bold whitespace-nowrap">PASADA: {activeFilters.pasada || 'N/A'}</td>
                                      <td className="border border-black px-1 py-0.5 font-bold whitespace-nowrap">MAX. ESTAB.: {minMaxData?.max ?? 'N/A'}</td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>
                    <div className="overflow-x-auto pb-4">
                        <table className="border-collapse border border-black text-[10px] w-full">
                            <thead className="text-center font-bold text-black min-w-full">
                                <tr className="bg-gray-300">
                                    <th className="border border-black px-1 py-0.5 font-bold w-20">FECHA</th>
                                    {multiDaySummary.map((day, index) => <th key={index} className="border border-black px-1 py-0.5 text-center font-bold">{day.summary.fecha}</th>)}
                                </tr>
                            </thead> 
                            <tbody className="bg-[#dbe5f1]">
                                {summaryRows.map(row => (
                                    <tr key={String(row.key)}>
                                        <td className={`border border-black px-1 py-0.5 font-bold w-20 whitespace-nowrap ${row.bgClass || ''}`}>{row.label}</td>
                                        {multiDaySummary.map((day, index) => {
                                            const value = day.summary[row.key];
                                            return (
                                                <td key={index} className={`border border-black px-1 py-0.5 text-center ${row.bgClass || ''}`}>
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
                    <p>Seleccione los filtros para ver un resumen.<br />Asegúrese de elegir Lote, Labor y Pasada.</p>
                </div>
            )}
        </div>
    );
}
