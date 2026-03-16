
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Loader2, Filter, RefreshCcw, Calendar as CalendarIcon, Clock, Camera, LayoutGrid, AlertCircle } from 'lucide-react';
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bar, CartesianGrid, Legend, XAxis, YAxis, LabelList, Line, ComposedChart, Tooltip as RechartsTooltip } from 'recharts';
import { DateRange } from "react-day-picker";

import { type ActivityRecordData, Presupuesto, MinMax } from '@/lib/types';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

// --- Sub-componente para la Tabla de Ficha de Actividad (Diseño Imagen 1) ---
function AssistantSummaryTable({ 
  data, 
  laborName, 
  lote, 
  pasada,
  responsibleName 
}: { 
  data: any[], 
  laborName: string, 
  lote: string, 
  pasada: string,
  responsibleName: string
}) {
    const totals = useMemo(() => {
        const rdto = data.reduce((s, d) => s + d.rdto, 0);
        const personas = data.reduce((s, d) => s + d.personas, 0);
        const jhu = data.reduce((s, d) => s + d.jhu, 0);
        
        const allMins = data.flatMap(d => d.mins).filter(v => v > 0);
        const allMaxs = data.flatMap(d => d.maxs).filter(v => v > 0);
        
        const min = allMins.length > 0 ? Math.min(...allMins) : 0;
        const max = allMaxs.length > 0 ? Math.max(...allMaxs) : 0;
        
        const prom = jhu > 0 ? rdto / jhu : 0;
        return { rdto, personas, jhu, prom, min, max };
    }, [data]);

    return (
        <div className="bg-white p-8 text-black border-2 border-black" style={{ width: 'fit-content', minWidth: '100%' }}>
            <div className="flex justify-between items-start mb-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold border-b-2 border-black pb-1 uppercase tracking-tight underline">REPORTE DE CAMPO - FICHA DE ACTIVIDAD</h2>
                    <div className="mt-3 space-y-1 text-sm font-bold uppercase">
                        <p>FECHA: {format(new Date(), "d 'de' MMMM, yyyy", { locale: es })}</p>
                        <p>LABOR: {laborName || '---'}</p>
                        <p>LOTE: {lote || '---'} | PASADA: {pasada || '0'}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold uppercase">RESPONSABLE: {responsibleName.toUpperCase()}</p>
                    <p className="text-xs text-gray-500 italic mt-2">Generado el {format(new Date(), 'dd/MM/yyyy, HH:mm')}</p>
                </div>
            </div>

            <table className="w-full border-collapse border-2 border-black text-sm">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-black p-3 text-center w-28 font-bold uppercase">FECHA</th>
                        <th className="border border-black p-3 text-left font-bold uppercase">ASISTENTE / ENCARGADO</th>
                        <th className="border border-black p-3 text-center w-32 font-bold uppercase">RDTO</th>
                        <th className="border border-black p-3 text-center w-24 font-bold uppercase">PERSONAS</th>
                        <th className="border border-black p-3 text-center w-24 font-bold uppercase">JHU</th>
                        <th className="border border-black p-3 text-center w-24 font-bold uppercase">PROM.</th>
                        <th className="border border-black p-3 text-center w-24 font-bold uppercase">MÍNIMO</th>
                        <th className="border border-black p-3 text-center w-24 font-bold uppercase">MÁXIMO</th>
                        <th className="border border-black p-3 text-left font-bold uppercase">OBS.</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => {
                        const rowMin = row.mins.length > 0 ? Math.min(...row.mins) : 0;
                        const rowMax = row.maxs.length > 0 ? Math.max(...row.maxs) : 0;
                        const prom = (Number(row.rdto) || 0) / (Number(row.jhu) || 1);
                        return (
                            <tr key={i}>
                                <td className="border border-black p-3 text-center font-mono whitespace-nowrap">{row.date}</td>
                                <td className="border border-black p-3 uppercase font-medium">{row.name}</td>
                                <td className="border border-black p-3 text-center font-mono">{row.rdto.toLocaleString('es-PE')}</td>
                                <td className="border border-black p-3 text-center font-mono">{row.personas}</td>
                                <td className="border border-black p-3 text-center font-mono">{row.jhu.toFixed(1)}</td>
                                <td className="border border-black p-3 text-center font-mono">{prom.toFixed(2)}</td>
                                <td className="border border-black p-3 text-center font-mono">{rowMin}</td>
                                <td className="border border-black p-3 text-center font-mono">{rowMax}</td>
                                <td className="border border-black p-3 text-[10px] text-gray-600 italic min-w-[150px]">{row.obs[0] || '---'}</td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot className="bg-white font-bold">
                    <tr className="border-t-2 border-black">
                        <td colSpan={2} className="border border-black p-3 text-right uppercase text-base">TOTAL GENERAL</td>
                        <td className="border border-black p-3 text-center text-base">{totals.rdto.toLocaleString('es-PE')}</td>
                        <td className="border border-black p-3 text-center text-base">{totals.personas}</td>
                        <td className="border border-black p-3 text-center text-base text-[#7c3aed] font-bold">{totals.jhu.toFixed(1)}</td>
                        <td className="border border-black p-3 text-center text-base font-bold">{totals.prom.toFixed(2)}</td>
                        <td className="border border-black p-3 text-center text-base font-bold">{totals.min}</td>
                        <td className="border border-black p-3 text-center text-base font-bold">{totals.max}</td>
                        <td className="border border-black p-3 bg-white"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

const formatAssistantName = (name: string) => {
    if (!name) return 'Desconocido';
    const parts = name.trim().split(' ');
    if (parts.length < 2) return name;
    const firstName = parts[0];
    const lastNameInitial = parts[parts.length - 1].charAt(0).toUpperCase() + '.';
    return `${firstName} ${lastNameInitial}`;
};


export default function ActivitySummaryPage() {
    const { toast } = useToast();
    const { profile } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [allActivities, setAllActivities] = useState<ActivityRecordData[]>([]);
    const [allPresupuestos, setAllPresupuestos] = useState<Presupuesto[]>([]);
    const [allMinMax, setAllMinMax] = useState<MinMax[]>([]);
    const { lotes: allLotes, labors: allLabors, asistentes, loading: masterLoading, refreshData: refreshMasterData } = useMasterData();
    
    const [activeFilters, setActiveFilters] = useState({ campaign: '', lote: '', labor: '', pasada: '' });
    const [popoverFilters, setPopoverFilters] = useState({ campaign: '', lote: '', labor: '', pasada: '' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const { setActions } = useHeaderActions();
    
    const assistantTableRef = useRef<HTMLDivElement>(null);

    const [chartDateRange, setChartDateRange] = useState<DateRange | undefined>(undefined);
    const [chartShiftFilter, setChartShiftFilter] = useState('todos');

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
                let registerDate: Date;
                if (data.registerDate?.toDate) {
                    registerDate = data.registerDate.toDate();
                } else if (typeof data.registerDate === 'string' && isValid(parseISO(data.registerDate))) {
                    registerDate = parseISO(data.registerDate);
                } else {
                    registerDate = new Date();
                }
                return { ...data, registerDate } as ActivityRecordData;
            });
            setAllActivities(activitiesData);
            
            const presupuestosData = presupuestosSnapshot.docs.map(doc => doc.data() as Presupuesto);
            setAllPresupuestos(presupuestosData);

            const minMaxData = minMaxSnapshot.docs.map(doc => doc.data() as MinMax);
            setAllMinMax(minMaxData);
            
            await refreshMasterData();

            if(showToast) {
                toast({ title: "Éxito", description: "Datos actualizados." });
            }

        } catch (error) {
            console.error("Error loading summary data:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos." });
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshMasterData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
            
            const minRanges = data.activities.map(a => a.minRange || 0).filter(v => v > 0);
            const maxRanges = data.activities.map(a => a.maxRange || 0).filter(v => v > 0);
            
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
        }).sort((a, b) => b.date.getTime() - a.date.getTime()); // Ordenar por fecha descendente

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
    
   const {data: assistantPerformanceData} = useMemo(() => {
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
          filtered = filtered.filter(a => a.registerDate <= endOfDay(chartDateRange.to!));
        }
        if (chartShiftFilter !== 'todos') {
            filtered = filtered.filter(a => a.shift === chartShiftFilter);
        }

        const assistantData = new Map<string, {
            name: string;
            performanceSum: number;
            workdaySum: number;
            specialPerformanceSum: number;
            promJhuValues: number[];
        }>();
        
        filtered.forEach(activity => {
            const assistantId = activity.assistantDni || activity.assistantName || 'Desconocido';
            const assistantName = activity.assistantName || asistentes.find(a => a.id === activity.assistantDni)?.assistantName || assistantId;
            
            if (!assistantData.has(assistantId)) {
                assistantData.set(assistantId, {
                    name: formatAssistantName(assistantName),
                    performanceSum: 0,
                    workdaySum: 0,
                    specialPerformanceSum: 0,
                    promJhuValues: [],
                });
            }
            const current = assistantData.get(assistantId)!;
            
            const performance = activity.performance || 0;
            const jhu = activity.workdayCount || 0;
            
            if (jhu > 0) {
                current.promJhuValues.push(performance / jhu);
            }

            current.performanceSum += performance;
            current.specialPerformanceSum += (activity.clustersOrJabas || 0);
            current.workdaySum += jhu;
        });
        
        const chartData = Array.from(assistantData.values()).map(data => {
            const promedio = data.workdaySum > 0 ? data.performanceSum / data.workdaySum : 0;
            return {
                name: data.name,
                promedio,
                jornadas: data.workdaySum,
            }
        });

        return { data: chartData };

    }, [allActivities, asistentes, activeFilters, chartDateRange, chartShiftFilter]);

    // --- Memo para la Tabla Grupal (Ficha de Actividad) ---
    const assistantSummaryTableData = useMemo(() => {
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
          filtered = filtered.filter(a => a.registerDate <= endOfDay(chartDateRange.to!));
        }
        if (chartShiftFilter !== 'todos') {
            filtered = filtered.filter(a => a.shift === chartShiftFilter);
        }

        const assistantGroups = new Map<string, {
            date: string;
            name: string;
            rdto: number;
            personas: number;
            jhu: number;
            mins: number[];
            maxs: number[];
            obs: string[];
        }>();

        filtered.forEach(act => {
            const dateStr = format(act.registerDate, 'dd/MM/yyyy');
            const assistantKey = act.assistantDni || act.assistantName || 'Unknown';
            const key = `${dateStr}-${assistantKey}`;
            
            if (!assistantGroups.has(key)) {
                assistantGroups.set(key, {
                    date: dateStr,
                    name: act.assistantName || asistentes.find(a => a.id === act.assistantDni)?.assistantName || 'Desconocido',
                    rdto: 0,
                    personas: 0,
                    jhu: 0,
                    mins: [],
                    maxs: [],
                    obs: []
                });
            }
            const g = assistantGroups.get(key)!;
            g.rdto += (act.performance || 0);
            g.personas += (act.personnelCount || 0);
            g.jhu += (act.workdayCount || 0);
            if (act.minRange) g.mins.push(act.minRange);
            if (act.maxRange) g.maxs.push(act.maxRange);
            if (act.observations) g.obs.push(act.observations);
        });

        // Ordenar por fecha descendente
        return Array.from(assistantGroups.values()).sort((a, b) => b.date.split('/').reverse().join('-').localeCompare(a.date.split('/').reverse().join('-')));
    }, [allActivities, activeFilters, chartDateRange, chartShiftFilter, asistentes]);
    
    const chartConfig: ChartConfig = {
        promedio: { label: "Promedio", color: "hsl(var(--primary))" },
        jornadas: { label: "Jornadas", color: "hsl(var(--secondary))" },
    };

    const summaryRows: { label: React.ReactNode; key: any; bgClass?: string, format?: (val: any) => string | number, special?: boolean }[] = [
        { label: "N° PERS.", key: "personas" },
        { label: "PLANTAS", key: "plantas", format: (v) => v.toLocaleString('es-PE') },
        { label: specialLaborName, key: "clustersOrJabas", special: true, format: (v) => v.toLocaleString('es-PE') },
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
      const lotes = [...new Set(allActivities.map(r => r.lote).filter(Boolean) as string[])].sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
      const labors = [...new Set(allActivities.map(r => r.labor).filter(Boolean) as string[])].sort();
      const pasadas = [...new Set(allActivities.map(a => String(a.pass)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

      return { campaigns, lotes, labors, pasadas };
    }, [allActivities]);
    
    const handleApplyFilters = useCallback(() => {
        setActiveFilters(popoverFilters);
        setIsFilterOpen(false);
    }, [popoverFilters]);

    const handleCaptureTable = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
        if (!ref.current) return;
        const element = ref.current;
        try {
            const html2canvas = (await import('html2canvas')).default;
            
            // Forzar renderizado para captura de ancho completo
            const canvas = await html2canvas(element, {
                scale: 3, // Calidad superior
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false,
                width: element.scrollWidth,
                height: element.scrollHeight,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
            });
            
            const link = document.createElement('a');
            link.download = `${filename}_${format(new Date(), 'ddMMyy_HHmm')}.png`;
            link.href = canvas.toDataURL("image/png", 1.0);
            link.click();
            toast({ title: "Captura Guardada", description: "El reporte se ha descargado como imagen completa." });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error al capturar reporte' });
        }
    };

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
                      <div className="space-y-2"><h4 className="font-medium leading-none">Filtros</h4></div>
                      <div className="grid gap-2">
                        <div className="grid gap-1">
                            <Label htmlFor="campaign-filter-summary">Campaña</Label>
                            <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, campaign: v === 'all' ? '' : v }))} value={popoverFilters.campaign}>
                            <SelectTrigger id="campaign-filter-summary" name="campaign-filter-summary"><SelectValue placeholder={loading ? "Cargando..." : "Todas"} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="lote-filter-summary">Lote</Label>
                            <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, lote: v === 'all' ? '' : v }))} value={popoverFilters.lote}>
                            <SelectTrigger id="lote-filter-summary" name="lote-filter-summary"><SelectValue placeholder={loading ? "Cargando..." : "Todos"} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                {filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="labor-filter-summary">Labor</Label>
                            <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, labor: v === 'all' ? '' : v }))} value={popoverFilters.labor}>
                            <SelectTrigger id="labor-filter-summary" name="labor-filter-summary"><SelectValue placeholder={loading ? "Cargando..." : "Todas"} /></SelectTrigger>
                            <SelectContent>
                                {filterOptions.labors.map((l, i) => <SelectItem key={l+i} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="pasada-filter-summary">Pasada</Label>
                            <Select onValueChange={(v) => setPopoverFilters(p => ({ ...p, pasada: v === 'all' ? '' : v }))} value={popoverFilters.pasada}>
                            <SelectTrigger id="pasada-filter-summary" name="pasada-filter-summary"><SelectValue placeholder={loading ? "Cargando..." : "Todas"} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {filterOptions.pasadas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                            </Select>
                        </div>
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
                <div className="space-y-8">
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
                                                const value = (day.summary as any)[row.key];
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

                    <Card className="border-2 shadow-md">
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                <div>
                                    <CardTitle className="text-2xl font-bold">Gráfico 1: Rendimiento Promedio</CardTitle>
                                    <CardDescription>Comparativa por asistente basada en los filtros activos.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button id="chart-date-range-summary" variant={"outline"} size="sm" className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !chartDateRange && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {chartDateRange?.from ? (chartDateRange.to ? (<>{format(chartDateRange.from, "LLL dd", {locale: es})} - {format(chartDateRange.to, "LLL dd", {locale: es})}</>) : (format(chartDateRange.from, "LLL dd, y", {locale: es}))) : (<span>Fecha</span>)}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <Calendar initialFocus mode="range" defaultMonth={chartDateRange?.from} selected={chartDateRange} onSelect={setChartDateRange} numberOfMonths={2} locale={es}/>
                                        </PopoverContent>
                                    </Popover>
                                    <Select value={chartShiftFilter} onValueChange={setChartShiftFilter}>
                                        <SelectTrigger id="chart-shift-filter-summary" name="chart-shift-filter-summary" className="w-[120px]">
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
                        <CardContent className="space-y-10">
                            {assistantPerformanceData.length > 0 ? (
                                <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
                                    <ComposedChart data={assistantPerformanceData} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" interval={0} />
                                        <YAxis yAxisId="left" orientation="left" stroke="var(--color-promedio)" />
                                        <YAxis yAxisId="right" orientation="right" stroke="var(--color-jornadas)" />
                                        <RechartsTooltip content={<ChartTooltipContent />} />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="promedio" fill="var(--color-promedio)" name="Promedio" barSize={50} radius={[4,4,0,0]} >
                                            <LabelList dataKey="promedio" position="top" formatter={(value: number) => Math.round(value)} />
                                        </Bar>
                                        <Line yAxisId="right" type="monotone" dataKey="jornadas" stroke="var(--color-jornadas)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Jornadas"/>
                                    </ComposedChart>
                                </ChartContainer>
                            ) : (
                                <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground border rounded-lg bg-slate-50/50 gap-2">
                                    <AlertCircle className="h-8 w-8 opacity-20" />
                                    <p>No hay datos para el rango de fechas o turno seleccionado en el gráfico.</p>
                                </div>
                            )}

                            {assistantSummaryTableData.length > 0 && (
                                <div className="space-y-4 pt-6 border-t border-dashed">
                                    <div className="flex justify-between items-center px-1">
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <LayoutGrid className="h-5 w-5 text-primary" />
                                            Ficha de Actividad (Resumen Grupal)
                                        </h3>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handleCaptureTable(assistantTableRef, `Ficha_Actividad_${activeFilters.lote}`)}
                                            className="h-10 border-primary/50 text-primary hover:bg-primary/5 rounded-xl shadow-sm"
                                        >
                                            <Camera className="mr-2 h-5 w-5"/>
                                            Capturar Ficha Completa
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto pb-4 rounded-xl border bg-slate-50/30">
                                        <div className="inline-block min-w-full p-4">
                                            <AssistantSummaryTable 
                                                data={assistantSummaryTableData} 
                                                laborName={activeFilters.labor}
                                                lote={activeFilters.lote}
                                                pasada={activeFilters.pasada}
                                                responsibleName={profile?.nombre || 'N/A'}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 pt-10 border-t">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-xl font-bold">Resumen Detallado por Lote</h3>
                                </div>
                                <div className="bg-white p-4 rounded-xl border shadow-sm overflow-x-auto">
                                    <DetailedSummaryTable 
                                        allActivities={allActivities} 
                                        allLotes={allLotes} 
                                        allPresupuestos={allPresupuestos} 
                                        allMinMax={allMinMax}
                                        activeFilters={activeFilters}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="flex h-64 items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <p>Seleccione los filtros para ver un resumen.<br />Asegúrese de elegir Lote, Labor y Pasada.</p>
                </div>
            )}

            {/* Contenedor oculto para la captura perfecta */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: 'max-content' }}>
                <div ref={assistantTableRef} style={{ width: 'max-content', background: 'white' }}>
                    <AssistantSummaryTable 
                        data={assistantSummaryTableData} 
                        laborName={activeFilters.labor}
                        lote={activeFilters.lote}
                        pasada={activeFilters.pasada}
                        responsibleName={profile?.nombre || 'N/A'}
                    />
                </div>
            </div>
        </div>
    );
}
