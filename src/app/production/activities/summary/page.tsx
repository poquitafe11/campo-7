
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Filter, RefreshCcw } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

import { type ActivityRecordData, type LoteData, Presupuesto, MinMax } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useMasterData } from '@/context/MasterDataContext';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DetailedSummaryTable } from '@/components/DetailedSummaryTable';


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

export default function ActivitySummaryPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [allActivities, setAllActivities] = useState<ActivityRecordData[]>([]);
    const [allPresupuestos, setAllPresupuestos] = useState<Presupuesto[]>([]);
    const [allMinMax, setAllMinMax] = useState<MinMax[]>([]);
    const { lotes: allLotes, labors: allLabors, loading: masterLoading, refreshData: refreshMasterData } = useMasterData();
    
    const [activeFilters, setActiveFilters] = useState({ campaign: '', lote: '', labor: '', pasada: '' });
    const [popoverFilters, setPopoverFilters] = useState({ campaign: '', lote: '', labor: '', pasada: '' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const { setActions } = useHeaderActions();

    const loadData = useCallback(async (showToast = false) => {
        setIsLoading(true);
        try {
            const [activitiesSnapshot, presupuestosSnapshot, minMaxSnapshot] = await Promise.all([
                getDocs(collection(db, 'actividades')),
                getDocs(collection(db, 'presupuesto')),
                getDocs(collection(db, 'min-max')),
            ]);

            const activitiesData = activitiesSnapshot.docs.map(doc => {
                const data = doc.data();
                const registerDate = data.registerDate?.toDate ? data.registerDate.toDate() : new Date();
                return { ...data, registerDate } as ActivityRecordData;
            });
            setAllActivities(activitiesData);
            
            const presupuestosData = presupuestosSnapshot.docs.map(doc => doc.data() as Presupuesto);
            setAllPresupuestos(presupuestosData);

            const minMaxData = minMaxSnapshot.docs.map(doc => doc.data() as MinMax);
            setAllMinMax(minMaxData);
            
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

    const multiDaySummary = useMemo(() => {
        const filteredActivities = allActivities.filter(a => {
            const campaignMatch = !activeFilters.campaign || (a.campaign === activeFilters.campaign);
            const loteMatch = !activeFilters.lote || a.lote === activeFilters.lote;
            const laborMatch = !activeFilters.labor || a.labor === activeFilters.labor;
            const pasadaMatch = !activeFilters.pasada || String(a.pass) === activeFilters.pasada;
            return campaignMatch && loteMatch && laborMatch && pasadaMatch;
        });

        if (filteredActivities.length === 0 || !activeFilters.lote || !activeFilters.labor || !activeFilters.pasada) return null;
        
        const cuartelesDelLote = allLotes.filter(l => l.lote === activeFilters.lote);
        if (cuartelesDelLote.length === 0) return null;

        const haProd = cuartelesDelLote.reduce((sum, cuartel) => sum + (cuartel.haProd || 0), 0);
        const densidad = cuartelesDelLote[0]?.densidad ?? 0;
        
        const dateMap = new Map<string, { personas: number; plantas: number; jhu: number; minRanges: number[]; maxRanges: number[] }>();
        
        filteredActivities.forEach(activity => {
            const dateKey = format(activity.registerDate, 'yyyy-MM-dd');
            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, { personas: 0, plantas: 0, jhu: 0, minRanges: [], maxRanges: [] });
            }
            const dayData = dateMap.get(dateKey)!;
            dayData.personas += activity.personnelCount;
            dayData.plantas += (activity.performance || 0);
            dayData.jhu += activity.workdayCount;
            if (activity.minRange) dayData.minRanges.push(activity.minRange);
            if (activity.maxRange) dayData.maxRanges.push(activity.maxRange);
        });
        
        const dailyData = Array.from(dateMap.entries()).map(([dateStr, data]) => {
            const hasDia = densidad > 0 ? data.plantas / densidad : 0;
            const avgMinRange = data.minRanges.length > 0 ? data.minRanges.reduce((a, b) => a + b, 0) / data.minRanges.length : 0;
            const avgMaxRange = data.maxRanges.length > 0 ? data.maxRanges.reduce((a, b) => a + b, 0) / data.maxRanges.length : 0;

            return {
                date: parseISO(dateStr),
                hasDia,
                summaryData: {
                    lote: activeFilters.lote,
                    pasada: parseInt(activeFilters.pasada, 10),
                    fecha: format(parseISO(dateStr), 'dd-MMM', { locale: es }),
                    personas: data.personas,
                    plantas: data.plantas,
                    jhu: data.jhu,
                    promedio: data.jhu > 0 ? data.plantas / data.jhu : 0,
                    plantasHora: data.jhu > 0 ? data.plantas / (data.jhu * 8) : 0,
                    has: Number(hasDia.toFixed(2)),
                    avance: haProd > 0 ? (hasDia / haProd) * 100 : 0,
                    haPorTrabajar: 0,
                    minimo: avgMinRange,
                    maximo: avgMaxRange,
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
                    haPorTrabajar: Number(haPorTrabajar.toFixed(2)),
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


    const summaryRows: { label: React.ReactNode; key: keyof SummaryValues; bgClass?: string, format?: (val: any) => string | number }[] = [
        { label: "N° PERS.", key: "personas" },
        { label: "PLANTAS", key: "plantas", format: (v) => v.toLocaleString('es-ES') },
        { label: "JHU", key: "jhu", format: (v) => v.toFixed(2) },
        { label: "PROMEDIO", key: "promedio", format: (v) => Math.round(v) },
        { label: "Pltas./H", key: "plantasHora", bgClass: "bg-[#f8cbad]", format: (v) => Math.round(v) },
        { label: "Has.", key: "has" },
        { label: "% Avance", key: "avance", format: (v) => `${Math.round(v)}%` },
        { label: "Ha x Trab.", key: "haPorTrabajar" },
        { label: "MINIMO", key: "minimo", format: (v) => Math.round(v) },
        { label: "MAXIMO", key: "maximo", format: (v) => Math.round(v) },
    ];
    
    const loading = isLoading || masterLoading;
    
    const filterOptions = useMemo(() => {
      const campaigns = [...new Set(allActivities.map(r => r.campaign).filter(Boolean))].sort();
      const lotes = [...new Set(allActivities.map(r => r.lote).filter(Boolean))].sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
      const labors = [...new Set(allActivities.map(r => r.labor).filter(Boolean))].sort();
      const pasadas = [...new Set(allActivities.map(a => String(a.pass)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

      return { campaigns, lotes, labors, pasadas };
    }, [allActivities]);
    
    const handleApplyFilters = useCallback(() => {
        setActiveFilters(popoverFilters);
        setIsFilterOpen(false);
    }, [popoverFilters]);

    useEffect(() => {
        setActions({
            title: <b>Resumen de Actividades</b>,
            right: (
              <div className="flex items-center gap-1">
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
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Filtros de Resumen</h4>
                      </div>
                      <div className="grid gap-2">
                        <Label>Campaña</Label>
                        <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, campaign: v === 'all' ? '' : v, lote: '' }))} value={popoverFilters.campaign}>
                          <SelectTrigger><SelectValue placeholder={loading ? "Cargando..." : "Todas"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Label>Lote</Label>
                        <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, lote: v === 'all' ? '' : v }))} value={popoverFilters.lote}>
                          <SelectTrigger><SelectValue placeholder={loading ? "Cargando..." : "Todos"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Label>Labor</Label>
                        <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, labor: v === 'all' ? '' : v }))} value={popoverFilters.labor}>
                          <SelectTrigger><SelectValue placeholder={loading ? "Cargando..." : "Todas"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {filterOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Label>Pasada</Label>
                        <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, pasada: v === 'all' ? '' : v }))} value={popoverFilters.pasada}>
                          <SelectTrigger><SelectValue placeholder={loading ? "Cargando..." : "Todas"} /></SelectTrigger>
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
              </div>
            ),
        });
        return () => setActions({});
    }, [setActions, isFilterOpen, popoverFilters, filterOptions, loading, handleApplyFilters, loadData]);


    return (
        <div className="w-full space-y-6">
             {loading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : multiDaySummary && multiDaySummary.length > 0 ? (
                <div className="space-y-4">
                    <div className="inline-block">
                          <table className="border-collapse border border-black text-[10px] table-auto">
                              <thead className="text-left font-bold text-black">
                                  <tr>
                                      <th colSpan={2} className="border border-black bg-gray-200 px-1 py-0.5 text-xs font-bold h-6 align-middle whitespace-nowrap">
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
                      
                    <div className="overflow-x-auto">
                        <table className="border-collapse border border-black text-xs table-auto">
                            <thead className="text-center font-bold text-black min-w-full">
                                <tr className="bg-gray-300">
                                    <th className="border border-black p-1 font-bold w-24">FECHA</th>
                                    {multiDaySummary.map((day, index) => <th key={index} className="border border-black p-1 text-center font-bold">{day.summary.fecha}</th>)}
                                </tr>
                            </thead> 
                            <tbody className="bg-[#dbe5f1]">
                                {summaryRows.map(row => (
                                    <tr key={String(row.key)}>
                                        <td className={`border border-black p-1 font-bold w-24 whitespace-nowrap ${row.bgClass || ''}`}>{row.label}</td>
                                        {multiDaySummary.map((day, index) => {
                                            const value = day.summary[row.key];
                                            return (
                                                <td key={index} className={`border border-black p-1 text-center ${row.bgClass || ''}`}>
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

            <DetailedSummaryTable 
                allActivities={allActivities} 
                allLotes={allLotes} 
                allPresupuestos={allPresupuestos} 
                allMinMax={allMinMax}
                activeFilters={activeFilters}
            />
        </div>
    );
}
