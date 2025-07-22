
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { ActivityRecordData, LoteData, Labor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';


const SummaryRow = ({ label, value, labelClasses = "", valueClasses = "" }: { label: string | React.ReactNode, value: string | number | React.ReactNode, labelClasses?: string, valueClasses?: string }) => (
    <tr className="bg-[#dbe5f1]">
        <td className={`border border-black px-4 py-2 font-bold ${labelClasses}`}>{label}</td>
        <td className={`border border-black px-4 py-2 text-center ${valueClasses}`}>{value}</td>
    </tr>
);

interface Filters {
    campaign: string;
    lote: string;
    labor: string;
    pasada: string;
}

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
                return { ...data, registerDate: data.registerDate.toDate() } as ActivityRecordData;
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

    const summaryData = useMemo<SummaryValues | null>(() => {
        if (!activeFilters.lote || !activeFilters.labor) return null;

        const filteredActivities = allActivities.filter(a => {
            const campañaMatch = activeFilters.campaign ? a.campaign === activeFilters.campaign : true;
            const pasadaMatch = activeFilters.pasada ? String(a.pass) === activeFilters.pasada : true;
            return campañaMatch &&
                   a.lote === activeFilters.lote &&
                   a.labor === activeFilters.labor &&
                   pasadaMatch;
        });

        if (filteredActivities.length === 0) return null;

        const loteInfo = allLotes.find(l => l.lote === activeFilters.lote);
        
        const personas = filteredActivities.reduce((sum, act) => sum + act.personnelCount, 0);
        const jhu = filteredActivities.reduce((sum, act) => sum + act.workdayCount, 0);
        const has = loteInfo?.ha || 0;
        const plantas = loteInfo?.plantasTotal || 0;

        const promedio = personas > 0 ? jhu / personas : 0;
        const plantasHora = jhu > 0 ? plantas / (jhu * 8) : 0; // Asumiendo 8 horas por jornada
        
        const lastActivityDate = filteredActivities.reduce((latest, act) => act.registerDate > latest ? act.registerDate : latest, new Date(0));

        // Placeholder for more complex calculations
        const avance = has > 0 ? ((jhu * 0.1) / has) * 100 : 0; // Example calculation
        const haPorTrabajar = has - (jhu * 0.1); // Example calculation
        const minPerf = Math.min(...filteredActivities.map(a => a.performance));
        const maxPerf = Math.max(...filteredActivities.map(a => a.performance));

        return {
            lote: activeFilters.lote,
            pasada: Number(activeFilters.pasada) || 0,
            fecha: format(lastActivityDate, 'dd-MMM', { locale: es }),
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
    }, [allActivities, allLotes, activeFilters]);

    const tableTitle = useMemo(() => {
        const labor = allLabors.find(l => l.descripcion === activeFilters.labor);
        const lote = allLotes.find(l => l.lote === activeFilters.lote);
        if (!labor || !lote) return "Resumen de Actividad";
        
        const variedad = lote.variedad || 'N/A';
        const variedadAbreviada = variedad.split(' ').map(w => w.substring(0,1)).join('').toUpperCase();

        return `${labor.descripcion.toUpperCase()} ${variedadAbreviada}`;

    }, [activeFilters, allLabors, allLotes]);

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
                ) : summaryData ? (
                    <div className="flex justify-center">
                        <div className="w-full max-w-sm">
                            <table className="w-full border-collapse border border-black">
                                <thead>
                                    <tr>
                                        <th colSpan={2} className="border border-black bg-gray-200 p-2 text-xl font-bold text-center">
                                            {tableTitle}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <SummaryRow label="Lote" value={summaryData.lote} labelClasses="bg-gray-300" valueClasses="bg-gray-300"/>
                                    <SummaryRow label={<span className="italic">Pasada</span>} value={summaryData.pasada} labelClasses="bg-gray-300" valueClasses="bg-gray-300"/>
                                    <SummaryRow label="FECHA" value={summaryData.fecha} />
                                    <SummaryRow label="N° PERSONAS" value={summaryData.personas} />
                                    <SummaryRow label="PLANTAS" value={summaryData.plantas.toLocaleString('es-ES')} />
                                    <SummaryRow label="JHU" value={summaryData.jhu.toFixed(2)} />
                                    <SummaryRow label="PROMEDIO" value={summaryData.promedio.toFixed(0)} />
                                    <SummaryRow label="Pltas./ Hora" value={summaryData.plantasHora} labelClasses="bg-[#f8cbad]" valueClasses="bg-[#f8cbad]" />
                                    <SummaryRow label="Has." value={summaryData.has} />
                                    <SummaryRow label="% Avance" value={summaryData.avance} />
                                    <SummaryRow label="Ha por Trabajar" value={summaryData.haPorTrabajar} />
                                    <SummaryRow label="MINIMO" value={summaryData.minimo} />
                                    <SummaryRow label="MAXIMO" value={summaryData.maximo} />
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

