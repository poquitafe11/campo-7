
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { ActivityRecordData, LoteData, Presupuesto } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Filter, RefreshCcw } from 'lucide-react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useMasterData } from '@/context/MasterDataContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, RadialBar, RadialBarChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AnalysisFilters {
    campaign: string;
    lote: string;
    labor: string;
}

const getInitialFilters = (): AnalysisFilters => ({
    campaign: '',
    lote: '',
    labor: '',
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

const chartConfigGauge = {
    value: {
        label: "Cumplimiento",
        color: "#ef4444", // red-500
    },
    background: {
        label: "Faltante",
        color: "#e5e7eb", // gray-200
    }
} satisfies ChartConfig;

export default function AnalysisPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [allActivities, setAllActivities] = useState<ActivityRecordData[]>([]);
    const [allPresupuestos, setAllPresupuestos] = useState<Presupuesto[]>([]);
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
            
            const presupuestosSnapshot = await getDocs(collection(db, 'presupuesto'));
            const presupuestosData = presupuestosSnapshot.docs.map(doc => doc.data() as Presupuesto);
            setAllPresupuestos(presupuestosData);
            
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
        const lotes = [...new Set(allActivities.map(a => a.lote))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        const labors = [...new Set(allActivities.map(a => a.labor).filter(Boolean) as string[])].sort();
        return { campaigns, lotes, labors };
    }, [allActivities]);

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
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, campaign: v === 'all' ? '' : v}))} value={popoverFilters.campaign}>
                                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Label>Lote</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, lote: v === 'all' ? '' : v}))} value={popoverFilters.lote}>
                                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Label>Labor</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, labor: v === 'all' ? '' : v}))} value={popoverFilters.labor}>
                                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {filterOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
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

    
    const filteredActivities = useMemo(() => {
        return allActivities.filter(a => {
            const campaignMatch = !activeFilters.campaign || a.campaign === activeFilters.campaign;
            const loteMatch = !activeFilters.lote || a.lote === activeFilters.lote;
            const laborMatch = !activeFilters.labor || a.labor === activeFilters.labor;
            return campaignMatch && loteMatch && laborMatch;
        });
    }, [allActivities, activeFilters]);

    const filteredPresupuestos = useMemo(() => {
        return allPresupuestos.filter(p => {
             // We can't filter by campaign on Presupuesto, so we ignore it.
            const loteMatch = !activeFilters.lote || parseInt(p.lote, 10) === parseInt(activeFilters.lote, 10);
            const laborMatch = !activeFilters.labor || p.descripcionLabor === activeFilters.labor;
            return loteMatch && laborMatch;
        });
    }, [allPresupuestos, activeFilters]);

    const analysisData = useMemo(() => {
        const dataByLabor: { [key: string]: { totalCost: number, totalJornadasHa: number, totalPerformance: number } } = {};
        
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
            
            const loteData = allLotes.find(l => l.lote === act.lote);
            const totalHaProdForLote = loteData?.haProd || 0;
            const jrHa = totalHaProdForLote > 0 ? (act.workdayCount || 0) / totalHaProdForLote : 0;
            
            if (act.labor) {
                if (!dataByLabor[act.labor]) dataByLabor[act.labor] = { totalCost: 0, totalJornadasHa: 0, totalPerformance: 0 };
                dataByLabor[act.labor].totalCost += costoEmpresa;
                dataByLabor[act.labor].totalJornadasHa += jrHa;
                dataByLabor[act.labor].totalPerformance += act.performance;
            }
        });

        const totalPresupuestoJrHa = filteredPresupuestos.reduce((sum, p) => sum + (p.jrnHa || 0), 0);
        
        const totalUsedJrHa = filteredActivities.reduce((sum, act) => {
             const loteData = allLotes.find(l => l.lote === act.lote);
             const totalHaProdForLote = loteData?.haProd || 0;
             const jrHa = totalHaProdForLote > 0 ? (act.workdayCount || 0) / totalHaProdForLote : 0;
             return sum + jrHa;
        }, 0);

        const percentage = totalPresupuestoJrHa > 0 ? (totalUsedJrHa / totalPresupuestoJrHa) * 100 : 0;

        const complianceData = [{
            name: "cumplimiento",
            value: totalUsedJrHa,
            fill: "var(--color-value)",
        }];
        
        const costByLaborChart = Object.entries(dataByLabor).map(([labor, data]) => ({
            name: labor,
            costo: parseFloat(data.totalCost.toFixed(2)),
        })).sort((a,b) => b.costo - a.costo);

        const workdaysByLaborChart = Object.entries(dataByLabor).map(([labor, data]) => ({
            name: labor,
            jornadas: parseFloat(data.totalJornadasHa.toFixed(2)),
        })).sort((a,b) => b.jornadas - a.jornadas);
        
        const totalHaForFilteredLotes = allLotes
          .filter(l => !activeFilters.lote || l.lote === activeFilters.lote)
          .reduce((acc, lote) => acc + (lote.ha || 0), 0);

        return { 
            costByLaborChart, 
            workdaysByLaborChart, 
            summaryTable: dataByLabor, 
            totalHa: totalHaForFilteredLotes,
            totalUsedJrHa,
            totalPresupuestoJrHa,
            complianceData,
            compliancePercentage: parseFloat(percentage.toFixed(1)),
        };
    }, [filteredActivities, filteredPresupuestos, allLotes, activeFilters.lote]);
    
    const renderContent = () => {
        if (isLoading || masterLoading) {
            return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
        }

        if (filteredActivities.length === 0) {
            return (
                 <div className="flex h-64 items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg">
                    <p>No se encontraron datos para los filtros seleccionados.<br/>Intenta con otros criterios.</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Cumplimiento de Jornadas/Ha</CardTitle>
                        <CardDescription>Comparación de Jornadas/Ha usadas vs. presupuestadas.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                        <ChartContainer
                            config={chartConfigGauge}
                            className="mx-auto aspect-square h-64 w-full max-w-sm"
                        >
                            <RadialBarChart
                                data={analysisData.complianceData}
                                startAngle={180}
                                endAngle={0}
                                innerRadius="70%"
                                outerRadius="100%"
                                barSize={72}
                                cy="60%"
                            >
                            <RadialBar
                                dataKey="value"
                                background={{ fill: "var(--color-background)" }}
                                cornerRadius={10}
                            />
                            <text
                                x="50%"
                                y="50%"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="fill-foreground text-5xl font-bold"
                            >
                                {analysisData.compliancePercentage.toLocaleString('es-PE')}%
                            </text>
                             <text
                                x="50%"
                                y="70%"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="fill-muted-foreground text-lg"
                            >
                                {analysisData.totalUsedJrHa.toFixed(2)} de {analysisData.totalPresupuestoJrHa.toFixed(2)} jrn/ha
                            </text>
                            </RadialBarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Costo Total por Labor</CardTitle>
                        <CardDescription>Costo de empresa (S/) según los filtros aplicados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfigCosto} className="min-h-[300px] w-full">
                            <BarChart data={analysisData.costByLaborChart} layout="vertical" margin={{ left: 50, right: 20 }}>
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
                        <CardTitle>Jornadas/Ha por Labor</CardTitle>
                        <CardDescription>Suma de Jornadas por Hectárea (JR/Ha) según los filtros.</CardDescription>
                    </CardHeader>
                     <CardContent>
                        <ChartContainer config={chartConfigJornadas} className="min-h-[300px] w-full">
                            <BarChart data={analysisData.workdaysByLaborChart} layout="vertical" margin={{ left: 50, right: 20 }}>
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
                    <CardHeader><CardTitle>Tabla de Resumen por Labor</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Labor</TableHead>
                                    <TableHead className="text-right">Rendimiento Total</TableHead>
                                    <TableHead className="text-right">Jornadas / Ha</TableHead>
                                    <TableHead className="text-right">Costo Empresa Total (S/)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.keys(analysisData.summaryTable).length > 0 ? (
                                    Object.entries(analysisData.summaryTable).map(([labor, data]) => (
                                        <TableRow key={labor}>
                                            <TableCell className="font-medium">{labor}</TableCell>
                                            <TableCell className="text-right">{data.totalPerformance.toLocaleString('en-US')}</TableCell>
                                            <TableCell className="text-right">{data.totalJornadasHa.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">{data.totalCost.toLocaleString('en-US', { style: 'currency', currency: 'PEN' })}</TableCell>
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
        );
    };

    return (
        <div className="space-y-6">
            {renderContent()}
        </div>
    );
}
