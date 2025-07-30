

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Filter,
  Loader2,
  LayoutGrid,
  RefreshCcw,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ActivityRecordData, LoteData, Presupuesto } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { ChartConfig, ChartContainer, ChartTooltipContent, ChartTooltip } from '@/components/ui/chart';
import { useMasterData } from '@/context/MasterDataContext';
import { Bar, BarChart, CartesianGrid, Legend, RadialBar, RadialBarChart, XAxis, YAxis } from 'recharts';


const formatNumber = (num: number, digits = 2) => {
  if (isNaN(num) || !isFinite(num)) {
    return '0.00';
  }
  return num.toLocaleString('es-PE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const initialFilters = {
  date: undefined as Date | undefined,
  lote: '',
  labor: '',
  pass: '',
};


export default function AnalysisPage() {
  const [allActivities, setAllActivities] = useState<ActivityRecordData[]>([]);
  const [allPresupuestos, setAllPresupuestos] = useState<Presupuesto[]>([]);
  const { lotes: allLotes, loading: masterLoading, refreshData: refreshMasterData } = useMasterData();
  const [isLoading, setIsLoading] = useState(true);
  
  const [filters, setFilters] = useState(initialFilters);
  const [drilldownLote, setDrilldownLote] = useState<string | null>(null);
  const [drilldownLabor, setDrilldownLabor] = useState<string | null>(null);

  const { toast } = useToast();

  const loadData = useCallback(async (showToast = false) => {
    setIsLoading(true);
    try {
      const [activitiesSnapshot, presupuestosSnapshot] = await Promise.all([
        getDocs(collection(db, 'actividades')),
        getDocs(collection(db, 'presupuesto')),
      ]);
      
      const activitiesData = activitiesSnapshot.docs.map(doc => {
          const data = doc.data();
          const registerDate = data.registerDate?.toDate ? data.registerDate.toDate() : new Date();
          return { ...data, id: doc.id, registerDate } as ActivityRecordData & {id: string};
      });
      setAllActivities(activitiesData);
      
      const presupuestosData = presupuestosSnapshot.docs.map(doc => doc.data() as Presupuesto);
      setAllPresupuestos(presupuestosData);
            
      await refreshMasterData();

      if (showToast) {
        toast({ title: 'Datos actualizados', description: 'La información más reciente ha sido cargada.' });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast, refreshMasterData]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const uniqueLotesOptions = useMemo(() => {
    return [...new Set(allLotes.map(l => l.lote))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [allLotes]);
  
  const dynamicOptions = useMemo(() => {
    let recordsForOptions = allActivities;

    if (filters.date) {
      const formattedDate = format(filters.date, 'yyyy-MM-dd');
      recordsForOptions = recordsForOptions.filter(r => {
        if (!r.registerDate) return false;
        try {
          const recordDate = format(r.registerDate, 'yyyy-MM-dd');
          return recordDate === formattedDate;
        } catch (e) { return false; }
      });
    }

    if (filters.lote) {
      recordsForOptions = recordsForOptions.filter(r => r.lote === filters.lote);
    }

    const labors = [...new Set(recordsForOptions.map(r => r.labor).filter(Boolean) as string[])].sort();
    
    if (filters.labor) {
      recordsForOptions = recordsForOptions.filter(r => r.labor === filters.labor);
    }
    
    const pasadas = [...new Set(recordsForOptions.map(r => String(r.pass)))].sort((a,b) => Number(a) - Number(b));

    return { labors, pasadas };
  }, [filters.lote, filters.date, filters.labor, allActivities]);
  
  const filteredRecords = useMemo(() => {
    if (allActivities.length === 0) return [];
    
    return allActivities.filter(r => {
      if (filters.date) {
        if (!r.registerDate) return false;
        try {
          if (format(r.registerDate, 'yyyy-MM-dd') !== format(filters.date as Date, 'yyyy-MM-dd')) return false;
        } catch (e) { return false; }
      }
      if (filters.lote && r.lote !== filters.lote) return false;
      if (filters.labor && r.labor !== filters.labor) return false;
      if (filters.pass && String(r.pass) !== filters.pass) return false;
      return true;
    });
  }, [filters, allActivities]);
  
  const cumplimientoChartData = useMemo(() => {
    const lotesInScope = filters.lote
      ? allLotes.filter(l => l.lote === filters.lote)
      : allLotes;

    if (lotesInScope.length === 0) {
      return { ejecutado: 0, presupuestado: 0, percentage: 0, data: [{ name: 'Empty', value: 1, fill: '#e0e0e0' }] };
    }
    
    const totalHaProd = lotesInScope.reduce((sum, l) => sum + (l.haProd || 0), 0);

    const budgetRowsToConsider = allPresupuestos.filter(p => {
        return lotesInScope.some(loteMaster => loteMaster.lote === p.lote);
    });
    
    const totalBudgetedJornadas = budgetRowsToConsider.reduce((sum, row) => sum + (row.jornadas || 0), 0);
    
    const presupuestado = totalHaProd > 0 ? totalBudgetedJornadas / totalHaProd : 0;
    
    const recordsToProcess = filteredRecords;
    const ejecutado = recordsToProcess.reduce((sum, r) => {
        const loteData = allLotes.find(l => l.lote === r.lote);
        const haProd = loteData?.haProd || 1; // Avoid division by zero
        return sum + ((r.workdayCount || 0) / haProd)
    }, 0);

    const percentage = presupuestado > 0 ? (ejecutado / presupuestado) * 100 : (ejecutado > 0 ? 100 : 0);

    const data = [
      { name: 'Ejecutado', value: ejecutado, fill: 'hsl(var(--primary))' },
    ];

    return {
      data,
      ejecutado: ejecutado,
      presupuestado: presupuestado,
      percentage: percentage,
    };
  }, [filteredRecords, allLotes, allPresupuestos, filters.lote]);
  
  const calculateCostoLabor = useCallback((reg: ActivityRecordData): number => {
    const costoUnitario = reg.cost || 0;
    const costoPorJornada = 60;
    let costoLabor = 0;

    if (costoUnitario > 0) {
      costoLabor = costoUnitario * (reg.performance || 0);
    } else {
      costoLabor = (reg.workdayCount || 0) * costoPorJornada;
    }
    return costoLabor;
  }, []);

  const calculatePromJhu = useCallback((reg: ActivityRecordData): number => {
    const jornadas = reg.workdayCount || 0;
    if (jornadas === 0) return 0;
    const rendimiento = reg.performance || 0;
    const result = rendimiento / jornadas;
    if (isNaN(result) || !isFinite(result)) return 0;
    return Math.round(result);
  }, []);
  
  const chartsData = useMemo(() => {
    let recordsForCharts = filteredRecords.filter(record => allLotes.some(l => l.lote === record.lote));

    let groupByKey: 'lote' | 'labor' = 'lote';

    if (drilldownLote) {
      recordsForCharts = recordsForCharts.filter(r => r.lote === drilldownLote);
      groupByKey = 'labor';
    } else if (filters.lote) {
      groupByKey = 'labor';
    }

    const groupedData = recordsForCharts.reduce((acc, record) => {
        const key = groupByKey === 'labor' ? record.labor : record.lote;
        const loteData = allLotes.find(l => l.lote === record.lote);
        if (!key || !loteData) return acc;

        if (!acc[key]) {
            acc[key] = { jrHa: 0, costo: 0, ha: 0, promJhuSum: 0, promJhuCount: 0, lotsProcessed: new Set() };
        }
        
        const jrHaValue = (loteData.haProd || 0) > 0 ? (record.workdayCount || 0) / loteData.haProd : 0;
        if (!isNaN(jrHaValue)) {
            acc[key].jrHa += jrHaValue;
        }

        acc[key].costo += calculateCostoLabor(record);

        const promJhuValue = calculatePromJhu(record);
        if (promJhuValue > 0) {
            acc[key].promJhuSum += promJhuValue;
            acc[key].promJhuCount += 1;
        }

        if (!acc[key].lotsProcessed.has(loteData.id)) {
            acc[key].ha += loteData.haProd || 0;
            acc[key].lotsProcessed.add(loteData.id);
        }
        
        return acc;
    }, {} as Record<string, { jrHa: number; costo: number; ha: number; promJhuSum: number; promJhuCount: number, lotsProcessed: Set<string> }>);
    
    const finalData = Object.entries(groupedData).map(([key, data]) => ({
      name: key,
      jrHa: data.jrHa,
      costoHa: data.ha > 0 ? data.costo / data.ha : 0,
      promJhu: data.promJhuCount > 0 ? data.promJhuSum / data.promJhuCount : 0,
    }));

    return { 
      data: finalData,
      groupBy: groupByKey
    };
  }, [filteredRecords, allLotes, filters.lote, drilldownLote, calculateCostoLabor, calculatePromJhu]);
  
  const evolutionChartData = useMemo(() => {
    let dataForChart;

    if (drilldownLabor) {
      const dailyData = filteredRecords
        .filter(r => r.labor === drilldownLabor)
        .reduce((acc, record) => {
          const date = format(record.registerDate, 'yyyy-MM-dd');
          if (!acc[date]) {
            acc[date] = { jrHaSum: 0, promJhuSum: 0, count: 0, costoHaSum: 0, haSum: 0 };
          }
          const loteData = allLotes.find(l => l.lote === record.lote);
          if (loteData?.haProd) {
            acc[date].jrHaSum += (record.workdayCount || 0) / loteData.haProd;
            const costoLabor = calculateCostoLabor(record);
            acc[date].costoHaSum += costoLabor / loteData.haProd;
          }
          acc[date].promJhuSum += calculatePromJhu(record);
          acc[date].count++;
          return acc;
        }, {} as Record<string, { jrHaSum: number; promJhuSum: number; count: number; costoHaSum: number; haSum: number }>);

      dataForChart = Object.entries(dailyData)
        .map(([date, values]) => ({
          name: date,
          ejecutadas: values.jrHaSum,
          promJhu: values.count > 0 ? values.promJhuSum / values.count : 0,
          costoHa: values.costoHaSum
        }))
        .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime())
        .map(item => ({ ...item, name: format(new Date(item.name), "dd MMM", { locale: es }) }));
    } else {
      const laborData = filteredRecords.reduce((acc, record) => {
        const labor = record.labor;
        if (!labor) return acc;
        if (!acc[labor]) {
          acc[labor] = { jrHaSum: 0, promJhuSum: 0, count: 0, costoHaSum: 0, haSum: 0 };
        }
        const loteData = allLotes.find(l => l.lote === record.lote);
        if (loteData?.haProd) {
            acc[labor].jrHaSum += (record.workdayCount || 0) / loteData.haProd;
            const costoLabor = calculateCostoLabor(record);
            acc[labor].costoHaSum += costoLabor / loteData.haProd;
        }
        acc[labor].promJhuSum += calculatePromJhu(record);
        acc[labor].count++;
        return acc;
      }, {} as Record<string, { jrHaSum: number; promJhuSum: number; count: number; costoHaSum: number; haSum: number }>);

      dataForChart = Object.entries(laborData).map(([labor, values]) => ({
        name: labor,
        ejecutadas: values.jrHaSum,
        promJhu: values.count > 0 ? values.promJhuSum / values.count : 0,
        costoHa: values.costoHaSum,
      }));
    }
    return dataForChart;
  }, [filteredRecords, drilldownLabor, calculatePromJhu, calculateCostoLabor, allLotes]);


  const handleClearFilters = () => {
    setFilters(initialFilters);
    setDrilldownLote(null);
    setDrilldownLabor(null);
  };
  
  const handleBarClick = (data: any) => {
    if (chartsData.groupBy === 'lote' && data && data.name) {
      setDrilldownLote(data.name);
    }
  };
  
  const handleEvolutionBarClick = (data: any) => {
    if (data && data.name && !drilldownLabor) {
      setDrilldownLabor(data.name);
    }
  };
  
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const chartConfig: ChartConfig = {
    jrHa: { label: "Jornadas/Ha", color: "#3b82f6" },
    costoHa: { label: "Costo/Ha (S/)", color: "#10b981" },
    promJhu: { label: "Prom./JHU", color: "#f97316" },
    ejecutadas: { label: "Jr/Ha Ejecutadas", color: "hsl(var(--primary))" },
  };

  const loading = isLoading || masterLoading;

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/production">
              <ArrowLeft />
              <span className="sr-only">Volver a Producción</span>
            </Link>
          </Button>
          <h1 className="text-lg font-semibold font-headline sm:text-xl">
            Análisis y Reportes
          </h1>
        </div>
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                        <Filter className="h-4 w-4" />
                        <span className="sr-only">Filtrar</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[90vw] max-w-sm p-4 sm:w-auto" align="end">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Filtros de Búsqueda</h4>
                            <p className="text-sm text-muted-foreground">
                                Selecciona los filtros para ver el resumen.
                            </p>
                        </div>
                        <div className="grid gap-4">
                             <div className="grid grid-cols-1 items-center gap-2">
                                <Label htmlFor="date-filter">Fecha</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date-filter" variant="outline" className={cn("w-full justify-start text-left font-normal", !filters.date && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {isClient && filters.date ? format(filters.date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={filters.date} onSelect={(date) => setFilters(prev => ({...initialFilters, date: date || undefined, lote: prev.lote}))} initialFocus locale={es}/></PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid grid-cols-1 items-center gap-2">
                                <Label htmlFor="lote-filter">Lote (Opcional)</Label>
                                <Select
                                value={filters.lote}
                                onValueChange={(value) =>
                                    setFilters((prev) => ({ ...prev, lote: value === 'all' ? '' : value, labor: '', pass: '' }))
                                }
                                >
                                <SelectTrigger id="lote-filter">
                                    <SelectValue placeholder="Todos los Lotes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los Lotes</SelectItem>
                                    {uniqueLotesOptions.map(lote => <SelectItem key={lote} value={lote}>{lote}</SelectItem>)}
                                </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-1 items-center gap-2">
                                <Label htmlFor="labor-filter">Labor (Opcional)</Label>
                                <Select
                                value={filters.labor}
                                onValueChange={(value) =>
                                    setFilters((prev) => ({ ...prev, labor: value === 'all' ? '' : value, pass: '' }))
                                }
                                disabled={dynamicOptions.labors.length === 0}
                                >
                                <SelectTrigger id="labor-filter"><SelectValue placeholder="Todas las Labores" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las Labores</SelectItem>
                                    {dynamicOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                </SelectContent>
                                </Select>
                            </div>
                             <div className="grid grid-cols-1 items-center gap-2">
                                <Label htmlFor="pasada-filter">Pasada (Opcional)</Label>
                                <Select
                                value={filters.pass}
                                onValueChange={(value) =>
                                    setFilters((prev) => ({ ...prev, pass: value === 'all' ? '' : value }))
                                }
                                disabled={dynamicOptions.pasadas.length === 0}
                                >
                                <SelectTrigger id="pasada-filter"><SelectValue placeholder="Todas las Pasadas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las Pasadas</SelectItem>
                                    {dynamicOptions.pasadas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                                Limpiar
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
           <Button variant="outline" size="icon" onClick={() => loadData(true)} disabled={loading}>
              <RefreshCcw className="h-4 w-4" />
              <span className="sr-only">Actualizar datos</span>
           </Button>
           <Button variant="ghost" size="icon" asChild>
             <Link href="/dashboard">
               <LayoutGrid />
               <span className="sr-only">Volver al dashboard</span>
             </Link>
           </Button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 space-y-6">
         {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
         ) : filteredRecords.length === 0 ? (
            <Card className="h-64 flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground">
                <p>No se encontraron datos para los filtros seleccionados.</p>
                <p className="text-sm">Intenta con otros criterios de búsqueda.</p>
              </CardContent>
            </Card>
         ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle>Cumplimiento del Presupuesto</CardTitle>
                    <CardDescription>Comparación de Jornadas/Ha ejecutadas vs. presupuestadas.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center gap-4">
                    <ChartContainer config={chartConfig} className="h-48 w-48">
                        <RadialBarChart 
                            data={cumplimientoChartData.data} 
                            startAngle={90} 
                            endAngle={-270} 
                            innerRadius="70%" 
                            outerRadius="100%"
                            barSize={20}
                        >
                            <RadialBar dataKey="value" background={{ fill: '#e0e0e0' }} cornerRadius={10} />
                            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideIndicator />} />
                        </RadialBarChart>
                    </ChartContainer>
                     <div className="text-center">
                        <p className="text-4xl font-bold text-primary">{formatNumber(cumplimientoChartData.percentage, 0)}%</p>
                        <p className="text-sm text-muted-foreground">
                            Ejec: {formatNumber(cumplimientoChartData.ejecutado, 2)} / Presup: {formatNumber(cumplimientoChartData.presupuestado, 2)}
                        </p>
                    </div>
                </CardContent>
             </Card>
             <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      Análisis por {chartsData.groupBy === 'lote' ? 'Lote' : `Lote ${drilldownLote} > Labor`}
                    </CardTitle>
                    <CardDescription>
                       Haz clic en una barra para ver el detalle.
                    </CardDescription>
                  </div>
                  {drilldownLote && (
                    <Button variant="outline" size="sm" onClick={() => setDrilldownLote(null)}>Volver a Lotes</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                  <BarChart data={chartsData.data} onClick={handleBarClick} layout="vertical">
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="jrHa" fill="var(--color-jrHa)" name="Jornadas/Ha" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="costoHa" fill="var(--color-costoHa)" name="Costo/Ha (S/)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="promJhu" fill="var(--color-promJhu)" name="Prom./JHU" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
             <Card className="lg:col-span-3">
                <CardHeader>
                     <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>
                                Evolución de {drilldownLabor ? `Labor: ${drilldownLabor}` : 'Labores'}
                            </CardTitle>
                             <CardDescription>
                                {drilldownLabor ? 'Vista diaria de la labor seleccionada.' : 'Haz clic en una labor para ver el detalle diario.'}
                            </CardDescription>
                        </div>
                        {drilldownLabor && (
                            <Button variant="outline" size="sm" onClick={() => setDrilldownLabor(null)}>Volver a Labores</Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                     <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                        <BarChart data={evolutionChartData} onClick={handleEvolutionBarClick}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="ejecutadas" fill="var(--color-ejecutadas)" name="Jr/Ha Ejecutadas" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="promJhu" fill="var(--color-promJhu)" name="Prom./JHU" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="costoHa" fill="var(--color-costoHa)" name="Costo/Ha" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
          </div>
         )}
      </main>
    </div>
  );
}
