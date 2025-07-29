
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { ActivityRecordData, LoteData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Filter, RefreshCcw } from 'lucide-react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useMasterData } from '@/context/MasterDataContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AnalysisFilters {
    campaign: string;
    variety: string;
}

const getInitialFilters = (): AnalysisFilters => ({
    campaign: '',
    variety: '',
});

const chartConfigCosto = {
  costo: {
    label: "Costo / Ha (S/)",
    color: "#38bdf8",
  },
} satisfies ChartConfig;

const chartConfigJornadas = {
  jornadas: {
    label: "Jornadas / Ha",
    color: "#10b981",
  },
} satisfies ChartConfig;

export default function AnalysisPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [allActivities, setAllActivities] = useState<ActivityRecordData[]>([]);
    const { lotes: allLotes, loading: masterLoading, refreshData: refreshMasterData } = useMasterData();

    const [activeFilters, setActiveFilters] = useState<AnalysisFilters>(getInitialFilters());
    const [popoverFilters, setPopoverFilters] = useState<AnalysisFilters>(getInitialFilters());
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

            if (showToast) {
                toast({ title: "Éxito", description: "Los datos han sido actualizados." });
            }

        } catch (error) {
            console.error("Error loading analysis data:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos para el análisis." });
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
        const varieties = [...new Set(allLotes.map(a => a.variedad))].sort();
        return { campaigns, varieties };
    }, [allActivities, allLotes]);

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
    
    useEffect(() => {
        setActions(
            <>
                <Button variant="ghost" size="icon" onClick={() => loadData(true)} disabled={isLoading} className="h-9 w-9 shrink-0">
                  <RefreshCcw className="h-5 w-5" />
                  <span className="sr-only">Actualizar</span>
                </Button>
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                            <Filter className="h-5 w-5" />
                             <span className="sr-only">Filtros</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                        <div className="grid gap-4">
                            <div className="space-y-2"><h4 className="font-medium leading-none">Filtros de Análisis</h4></div>
                            <div className="grid gap-2">
                                <Label>Campaña</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, campaign: v}))} value={popoverFilters.campaign}>
                                    <SelectTrigger><SelectValue placeholder="Seleccione Campaña" /></SelectTrigger>
                                    <SelectContent>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                                <Label>Variedad</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, variety: v}))} value={popoverFilters.variety}>
                                    <SelectTrigger><SelectValue placeholder="Seleccione Variedad" /></SelectTrigger>
                                    <SelectContent>{filterOptions.varieties.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={handleClearFilters}>Limpiar</Button>
                                <Button size="sm" onClick={handleApplyFilters}>Aplicar</Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </>
        );
         return () => setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFilterOpen, isLoading, popoverFilters, filterOptions]);

    const lotesForSelectedVariety = useMemo(() => {
      if (!activeFilters.variety) return [];
      return allLotes.filter(l => l.variedad === activeFilters.variety);
    }, [activeFilters.variety, allLotes]);
    
    const totalHaForVariety = useMemo(() => {
        return lotesForSelectedVariety.reduce((acc, lote) => acc + (lote.ha || 0), 0);
    }, [lotesForSelectedVariety]);


    const filteredActivities = useMemo(() => {
        if (!activeFilters.campaign || !activeFilters.variety) return [];
        const loteNamesForVariety = lotesForSelectedVariety.map(l => l.lote);
        
        return allActivities.filter(a => {
            const campaignMatch = a.campaign === activeFilters.campaign;
            const loteMatch = loteNamesForVariety.includes(a.lote);
            return campaignMatch && loteMatch;
        });
    }, [allActivities, activeFilters, lotesForSelectedVariety]);

    const analysisData = useMemo(() => {
        const dataByLabor: { [key: string]: { totalCost: number, totalWorkdays: number, totalPerformance: number } } = {};
        
        filteredActivities.forEach(act => {
            const cost = act.cost || 0;
            let costoLabor = 0;
            if (cost === 0) {
                costoLabor = (act.workdayCount || 0) * 60;
            } else {
                const specialLabors = ['46', '67'];
                const numerator = specialLabors.includes(act.code || '') ? 0 : (act.performance || 0);
                costoLabor = numerator * cost;
            }
            const costoEmpresa = costoLabor * 1.30;
            
            if (act.labor) {
                if (!dataByLabor[act.labor]) dataByLabor[act.labor] = { totalCost: 0, totalWorkdays: 0, totalPerformance: 0 };
                dataByLabor[act.labor].totalCost += costoEmpresa;
                dataByLabor[act.labor].totalWorkdays += act.workdayCount;
                dataByLabor[act.labor].totalPerformance += act.performance;
            }
        });
        
        const costByLaborPerHaChart = Object.entries(dataByLabor).map(([labor, data]) => ({
            name: labor,
            costo: totalHaForVariety > 0 ? parseFloat((data.totalCost / totalHaForVariety).toFixed(2)) : 0,
        })).sort((a,b) => b.costo - a.costo);

        const workdaysByLaborPerHaChart = Object.entries(dataByLabor).map(([labor, data]) => ({
            name: labor,
            jornadas: totalHaForVariety > 0 ? parseFloat((data.totalWorkdays / totalHaForVariety).toFixed(2)) : 0,
        })).sort((a,b) => b.jornadas - a.jornadas);

        return { costByLaborPerHaChart, workdaysByLaborPerHaChart, summaryTable: dataByLabor };
    }, [filteredActivities, totalHaForVariety]);

    if (isLoading || masterLoading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            {!activeFilters.campaign || !activeFilters.variety ? (
                 <div className="flex h-64 items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <p>Seleccione una Campaña y una Variedad para iniciar el análisis.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Costo por Hectárea por Labor</CardTitle>
                            <CardDescription>Costo de empresa (S/) por hectárea para la variedad {activeFilters.variety}.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfigCosto} className="min-h-[300px] w-full">
                                <BarChart data={analysisData.costByLaborPerHaChart} layout="vertical" margin={{ left: 50, right: 20 }}>
                                    <CartesianGrid horizontal={false} />
                                    <XAxis type="number" dataKey="costo" tickFormatter={(value) => `S/ ${value.toLocaleString('en-US')}`} />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                                    <Bar dataKey="costo" fill="var(--color-costo)" radius={4} />
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Jornadas por Hectárea por Labor</CardTitle>
                            <CardDescription>Suma de jornadas de trabajo (JHU) por hectárea para la variedad {activeFilters.variety}.</CardDescription>
                        </CardHeader>
                         <CardContent>
                            <ChartContainer config={chartConfigJornadas} className="min-h-[300px] w-full">
                                <BarChart data={analysisData.workdaysByLaborPerHaChart} layout="vertical" margin={{ left: 50, right: 20 }}>
                                    <CartesianGrid horizontal={false} />
                                    <XAxis type="number" dataKey="jornadas" />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="jornadas" fill="var(--color-jornadas)" radius={4} />
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card className="lg:col-span-2">
                        <CardHeader><CardTitle>Tabla de Resumen por Labor (Variedad: {activeFilters.variety})</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Labor</TableHead>
                                        <TableHead className="text-right">Rendimiento Total</TableHead>
                                        <TableHead className="text-right">Jornadas / Ha</TableHead>
                                        <TableHead className="text-right">Costo Empresa / Ha (S/)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.keys(analysisData.summaryTable).length > 0 ? (
                                        Object.entries(analysisData.summaryTable).map(([labor, data]) => (
                                            <TableRow key={labor}>
                                                <TableCell className="font-medium">{labor}</TableCell>
                                                <TableCell className="text-right">{data.totalPerformance.toLocaleString('en-US')}</TableCell>
                                                <TableCell className="text-right">{totalHaForVariety > 0 ? (data.totalWorkdays / totalHaForVariety).toFixed(2) : '0.00'}</TableCell>
                                                <TableCell className="text-right">{totalHaForVariety > 0 ? (data.totalCost / totalHaForVariety).toLocaleString('en-US', { style: 'currency', currency: 'PEN' }) : 'S/ 0.00'}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">No hay datos para los filtros seleccionados.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
