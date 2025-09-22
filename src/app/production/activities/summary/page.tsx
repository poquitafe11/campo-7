
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Filter, RefreshCcw, User as UserIcon, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis, LabelList, Line, ComposedChart, Tooltip, ResponsiveContainer } from 'recharts';
import { DateRange } from "react-day-picker";

import { type ActivityRecordData, type LoteData, Presupuesto, MinMax, Assistant } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { useMasterData } from '@/context/MasterDataContext';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DetailedSummaryTable } from '@/components/DetailedSummaryTable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';


interface SummaryValues {
    lote: string;
    pasada: number;
    fecha: string;
    personas: number;
    plantas: number;
    clustersOrJabas: number;
    jhu: number;
    promedio: number;
    promedioRacimos: number;
    plantasHora: number;
    has: number;
    avance: string;
    haPorTrabajar: number;
    minimo: number;
    maximo: number;
}

const renderCustomizedLabel = (props: any) => {
  const { x, y, width, height, payload } = props;
  
  if (!payload || typeof payload.promedio === 'undefined') {
    return null;
  }

  const { max, promedio, min } = payload;
  const barCenter = x + width / 2;

  const isValidNumber = (val: any) => typeof val === 'number' && isFinite(val);

  return (
    <g>
      {isValidNumber(max) && (
        <text x={barCenter} y={y + 8} fill="#22c55e" textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="bold">
          {Math.round(max)}
        </text>
      )}
      {isValidNumber(promedio) && (
        <text x={barCenter} y={y + 22} fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="bold">
          {Math.round(promedio)}
        </text>
      )}
      {isValidNumber(min) && (
        <text x={barCenter} y={y + 36} fill="#ef4444" textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="bold">
          {Math.round(min)}
        </text>
      )}
    </g>
  );
};


export default function ActivitySummaryPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [allActivities, setAllActivities] = useState<ActivityRecordData[]>([]);
    const [allPresupuestos, setAllPresupuestos] = useState<Presupuesto[]>([]);
    const [allMinMax, setAllMinMax] = useState<MinMax[]>([]);
    const { lotes: allLotes, labors: allLabors, asistentes, loading: masterLoading, refreshData: refreshMasterData } = useMasterData();
    const [users, setUsers] = useState<any[]>([]);
    
    const [activeFilters, setActiveFilters] = useState({ campaign: '', lote: '', labor: '', pasada: '' });
    const [popoverFilters, setPopoverFilters] = useState({ campaign: '', lote: '', labor: '', pasada: '' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const { setActions } = useHeaderActions();
    
    // New state for chart-specific date range
    const [chartDateRange, setChartDateRange] = useState<DateRange | undefined>(undefined);
    const [chartShiftFilter, setChartShiftFilter] = useState('todos');

    const loadData = useCallback(async (showToast = false) => {
        setIsLoading(true);
        try {
            const [activitiesSnapshot, presupuestosSnapshot, minMaxSnapshot, usersSnapshot] = await Promise.all([
                getDocs(collection(db, 'actividades')),
                getDocs(collection(db, 'presupuesto')),
                getDocs(collection(db, 'min-max')),
                getDocs(collection(db, 'usuarios')),
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

            const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersData);
            
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
        
        const dateMap = new Map<string, { personas: number; plantas: number; clustersOrJabas: number; jhu: number; activities: ActivityRecordData[] }>();
        
        filteredActivities.forEach(activity => {
            const dateKey = format(activity.registerDate, 'yyyy-MM-dd');
            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, { personas: 0, plantas: 0, clustersOrJabas: 0, jhu: 0, activities: [] });
            }
            const dayData = dateMap.get(dateKey)!;
            dayData.personas += activity.personnelCount;
            dayData.plantas += (activity.performance || 0);
            dayData.clustersOrJabas += (activity.clustersOrJabas || 0);
            dayData.jhu += activity.workdayCount;
            dayData.activities.push(activity);
        });
        
        const dailyData = Array.from(dateMap.entries()).map(([dateStr, data]) => {
            const hasDia = densidad > 0 ? data.plantas / densidad : 0;
            
            const minRanges = data.activities.map(a => a.minRange || 0);
            const maxRanges = data.activities.map(a => a.maxRange || 0);
            
            const min = minRanges.length > 0 ? Math.min(...minRanges) : 0;
            const max = maxRanges.length > 0 ? Math.max(...maxRanges) : 0;
            
            return {
                date: parseISO(dateStr),
                hasDia,
                summaryData: {
                    lote: activeFilters.lote,
                    pasada: parseInt(activeFilters.pasada, 10),
                    fecha: format(parseISO(dateStr), 'dd-MMM', { locale: es }),
                    personas: data.personas,
                    plantas: data.plantas,
                    clustersOrJabas: data.clustersOrJabas,
                    jhu: data.jhu,
                    promedio: data.jhu > 0 ? data.plantas / data.jhu : 0,
                    promedioRacimos: data.jhu > 0 ? data.clustersOrJabas / data.jhu : 0,
                    plantasHora: data.jhu > 0 ? data.plantas / (data.jhu * 8) : 0,
                    has: Number(hasDia.toFixed(2)),
                    avance: haProd > 0 ? (hasDia / haProd) * 100 : 0,
                    haPorTrabajar: 0,
                    minimo: min,
                    maximo: max,
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
        }).sort((a, b) => b.date.getTime() - a.date.getTime());

        return summariesWithCumulative;

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

    const isSpecialLabor = useMemo(() => {
        const laborCode = allLabors.find(l => l.descripcion === activeFilters.labor)?.codigo;
        return ['46', '67'].includes(laborCode || '');
    }, [activeFilters.labor, allLabors]);

    const specialLaborName = useMemo(() => {
        if (!isSpecialLabor) return '';
        const laborCode = allLabors.find(l => l.descripcion === activeFilters.labor)?.codigo;
        if (laborCode === '46') return 'RACIMOS';
        if (laborCode === '67') return 'JABAS';
        return '';
    }, [isSpecialLabor, activeFilters.labor, allLabors]);
    
   const {data: assistantPerformanceData, maxRendimiento} = useMemo(() => {
        let filtered = allActivities.filter(a => {
            const campaignMatch = !activeFilters.campaign || (a.campaign === activeFilters.campaign);
            const loteMatch = !activeFilters.lote || a.lote === activeFilters.lote;
            const laborMatch = !activeFilters.labor || a.labor === activeFilters.labor;
            const pasadaMatch = !activeFilters.pasada || String(a.pass) === activeFilters.pasada;
            return campaignMatch && loteMatch && laborMatch && pasadaMatch;
        });
        
        if (chartDateRange?.from) {
          filtered = filtered.filter(a => a.registerDate >= startOfDay(chartDateRange.from!));
        }
        if (chartDateRange?.to) {
          filtered = filtered.filter(a => a.registerDate <= startOfDay(chartDateRange.to!));
        }
        if (chartShiftFilter !== 'todos') {
            filtered = filtered.filter(a => a.shift === chartShiftFilter);
        }

        const assistantData = new Map<string, {
            performanceSum: number;
            workdaySum: number;
            specialPerformanceSum: number;
            promJhuValues: number[];
        }>();
        
        const assistantNameMap = new Map<string, string>();
        asistentes.forEach(a => {
            assistantNameMap.set(a.id, a.assistantName);
        });
        
        const formatAssistantName = (name: string) => {
            if (!name) return '';
            const parts = name.trim().split(' ');
            if (parts.length < 2) return name;
            const firstName = parts[0];
            const lastNameInitial = parts[parts.length - 1].charAt(0).toUpperCase() + '.';
            return `${firstName} ${lastNameInitial}`;
        };

        filtered.forEach(activity => {
            const assistantDni = activity.assistantDni;
            if (assistantDni) {
                if (!assistantData.has(assistantDni)) {
                    assistantData.set(assistantDni, {
                        performanceSum: 0,
                        workdaySum: 0,
                        specialPerformanceSum: 0,
                        promJhuValues: [],
                    });
                }
                const current = assistantData.get(assistantDni)!;
                
                const performance = activity.performance || 0;
                const jhu = activity.workdayCount || 0;
                
                if (jhu > 0) {
                    current.promJhuValues.push(performance / jhu);
                }

                current.performanceSum += performance;
                current.specialPerformanceSum += (activity.clustersOrJabas || 0);
                current.workdaySum += jhu;
            }
        });
        
        const chartData = Array.from(assistantData.entries()).map(([assistantId, data]) => {
            const promedio = data.workdaySum > 0 ? data.performanceSum / data.workdaySum : 0;
            const min = data.promJhuValues.length > 0 ? Math.min(...data.promJhuValues) : 0;
            const max = data.promJhuValues.length > 0 ? Math.max(...data.promJhuValues) : 0;
            
            return {
                name: formatAssistantName(assistantNameMap.get(assistantId) || assistantId),
                promedio,
                min,
                max,
                rendimiento: isSpecialLabor ? data.specialPerformanceSum : data.performanceSum,
                jornadas: data.workdaySum,
            }
        });

        const maxRendimiento = Math.max(0, ...chartData.map(d => d.rendimiento));

        return { data: chartData, maxRendimiento };

    }, [allActivities, asistentes, activeFilters, isSpecialLabor, chartDateRange, chartShiftFilter]);

    const chartConfig: ChartConfig = {
        promedio: { label: "Promedio", color: "#3b82f6" },
        min: { label: "Mínimo", color: "#ef4444" },
        max: { label: "Máximo", color: "#22c55e" },
        jornadas: { label: "Jornadas", color: "hsl(var(--primary))" },
    };

    const summaryRows: { label: React.ReactNode; key: keyof SummaryValues; bgClass?: string, format?: (val: any) => string | number, special?: boolean }[] = [
        { label: "N° PERS.", key: "personas" },
        { label: "PLANTAS", key: "plantas", format: (v) => v.toLocaleString('es-ES') },
        { label: specialLaborName, key: "clustersOrJabas", special: true, format: (v) => v.toLocaleString('es-ES') },
        { label: "JHU", key: "jhu", format: (v) => v.toFixed(2) },
        { label: "PROMEDIO", key: "promedio", format: (v) => Math.round(v) },
        { label: `PROM. ${specialLaborName ? specialLaborName.substring(0,3) : ''}`, key: "promedioRacimos", special: true, format: (v) => Math.round(v) },
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
                            {filterOptions.labors.map((l, i) => <SelectItem key={l+i} value={l}>{l}</SelectItem>)}
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
                                {summaryRows.map(row => {
                                    if (row.special && !isSpecialLabor) return null;
                                    return (
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
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {assistantPerformanceData.length > 0 && (
                         <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                    <div>
                                        <CardTitle>Gráfico 1: Promedio de Rendimiento por Asistente</CardTitle>
                                        <CardDescription>
                                            Comparativa del rendimiento promedio, mínimo, máximo y jornadas por asistente.
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button id="date" variant={"outline"} size="sm" className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !chartDateRange && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {chartDateRange?.from ? (chartDateRange.to ? (<>{format(chartDateRange.from, "LLL dd", {locale: es})} - {format(chartDateRange.to, "LLL dd", {locale: es})}</>) : (format(chartDateRange.from, "LLL dd, y", {locale: es}))) : (<span>Fecha</span>)}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="end">
                                                <Calendar initialFocus mode="range" defaultMonth={chartDateRange?.from} selected={chartDateRange} onSelect={setChartDateRange} numberOfMonths={2} locale={es}/>
                                            </PopoverContent>
                                        </Popover>
                                        <Select value={chartShiftFilter} onValueChange={setChartShiftFilter}>
                                            <SelectTrigger className="w-[120px]">
                                                <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><SelectValue /></div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todos">Todos</SelectItem>
                                                <SelectItem value="Mañana">Mañana</SelectItem>
                                                <SelectItem value="Tarde">Tarde</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
                                    <ComposedChart data={assistantPerformanceData} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" interval={0} />
                                        <YAxis yAxisId="left" orientation="left" stroke="var(--color-promedio)" />
                                        <YAxis yAxisId="right" orientation="right" stroke="var(--color-jornadas)" />
                                        <Tooltip content={<ChartTooltipContent />} />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="promedio" fill="var(--color-promedio)" barSize={60}>
                                          <LabelList 
                                              dataKey="promedio"
                                              position="top"
                                              content={renderCustomizedLabel}
                                            />
                                        </Bar>
                                        <Line yAxisId="right" type="monotone" dataKey="jornadas" stroke="var(--color-jornadas)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Jornadas"/>
                                    </ComposedChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    )}
                    
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

    
