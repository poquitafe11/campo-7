
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMasterData } from '@/context/MasterDataContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type HealthRecord = {
    id: string;
    'Fecha Plan de Aplicación': string;
    [key: string]: any;
};

interface Filters {
    campana: string;
    lote: string;
    objetivo: string;
    categoria: string;
}

const getInitialFilters = (): Filters => ({
    campana: '',
    lote: '',
    objetivo: '',
    categoria: '',
});

export default function HealthSummaryPage() {
    const { toast } = useToast();
    const { lotes, loading: masterLoading } = useMasterData();
    const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeFilters, setActiveFilters] = useState<Filters>(getInitialFilters());
    const [popoverFilters, setPopoverFilters] = useState<Filters>(getInitialFilters());
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    const lotesMap = useMemo(() => {
        const map = new Map<string, any>();
        lotes.forEach(lote => {
            if (!map.has(lote.lote)) {
                map.set(lote.lote, lote);
            }
        });
        return map;
    }, [lotes]);


    useEffect(() => {
        setLoading(true);
        const unsubscribe = onSnapshot(collection(db, "registros-sanidad"), (snapshot) => {
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthRecord));
            setHealthRecords(records);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching health records: ", error);
            toast({ variant: "destructive", title: "Error de Carga", description: "No se pudieron cargar los registros de sanidad." });
            setLoading(false);
        });
        return () => unsubscribe();
    }, [toast]);

    const filterOptions = useMemo(() => {
        const campaigns = [...new Set(healthRecords.map(r => r['Campaña']))].filter(Boolean).sort();
        const lotesOptions = [...new Set(healthRecords.map(r => r['Lote']))].filter(Boolean).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        const objetivos = [...new Set(healthRecords.map(r => r['Objetivo']))].filter(Boolean).sort();
        const categorias = [...new Set(healthRecords.map(r => r['Categoria']))].filter(Boolean).sort();
        return { campaigns, lotes: lotesOptions, objetivos, categorias };
    }, [healthRecords]);

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

    const processedData = useMemo(() => {
        if (!activeFilters.lote || !activeFilters.objetivo) return [];

        let filtered = healthRecords.filter(r =>
            r['Lote'] === activeFilters.lote &&
            r['Objetivo'] === activeFilters.objetivo &&
            (!activeFilters.campana || r['Campaña'] === activeFilters.campana) &&
            (!activeFilters.categoria || r['Categoria'] === activeFilters.categoria)
        );

        // Group by date, product, and active ingredient to consolidate cuarteles
        const groupedByApplication: { [key: string]: HealthRecord & { cuarteles: string[] } } = {};
        filtered.forEach(record => {
            const date = record['Fecha Plan de Aplicación'];
            const product = record['Producto'];
            const ingredient = record['Ingrediente Activo'];
            const key = `${date}-${product}-${ingredient}`;

            if (!groupedByApplication[key]) {
                groupedByApplication[key] = { ...record, cuarteles: [] };
            }
            if (record['Cuartel']) {
                groupedByApplication[key].cuarteles.push(record['Cuartel']);
            }
        });
        
        const uniqueApplications = Object.values(groupedByApplication).map(record => ({
            ...record,
            cuarteles: [...new Set(record.cuarteles)].join(', '),
            parsedDate: parseISO(record['Fecha Plan de Aplicación'])
        })).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
        
        // Calculate days since last application
        return uniqueApplications.map((record, index) => {
            let daysSinceLast = 'N/A';
            if (index > 0) {
                const prevDate = uniqueApplications[index - 1].parsedDate;
                daysSinceLast = differenceInDays(record.parsedDate, prevDate).toString();
            }
            return { ...record, daysSinceLast };
        }).reverse(); // Show most recent first

    }, [healthRecords, activeFilters]);

    const isContentReady = !loading && !masterLoading;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <PageHeader title="Resumen de Sanidad" />
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filtros</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                        <div className="grid gap-4">
                            <div className="space-y-2"><h4 className="font-medium leading-none">Filtros</h4></div>
                            <div className="grid gap-2">
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label>Campaña</Label>
                                    <Select onValueChange={(v) => setPopoverFilters(p => ({...p, campana: v === 'all' ? '' : v}))} value={popoverFilters.campana}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label>Lote</Label>
                                    <Select onValueChange={(v) => setPopoverFilters(p => ({...p, lote: v === 'all' ? '' : v}))} value={popoverFilters.lote}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                                </div>
                                 <div className="grid grid-cols-3 items-center gap-4">
                                    <Label>Objetivo</Label>
                                    <Select onValueChange={(v) => setPopoverFilters(p => ({...p, objetivo: v === 'all' ? '' : v}))} value={popoverFilters.objetivo}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.objetivos.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                </div>
                                 <div className="grid grid-cols-3 items-center gap-4">
                                    <Label>Categoría</Label>
                                    <Select onValueChange={(v) => setPopoverFilters(p => ({...p, categoria: v === 'all' ? '' : v}))} value={popoverFilters.categoria}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" size="sm" onClick={handleClearFilters}>Limpiar</Button>
                                <Button size="sm" onClick={handleApplyFilters}>Aplicar</Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            
             {!isContentReady ? (
                <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : !activeFilters.lote || !activeFilters.objetivo ? (
                <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground text-center">Seleccione al menos un Lote y un Objetivo para ver el resumen.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Información del Filtro</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableBody>
                                    <TableRow>
                                        <TableHead>Lote</TableHead>
                                        <TableCell>{activeFilters.lote}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableHead>Objetivo</TableHead>
                                        <TableCell>{activeFilters.objetivo}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Detalle de Aplicaciones</CardTitle></CardHeader>
                        <CardContent>
                             <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>DDC</TableHead>
                                            <TableHead>Lote</TableHead>
                                            <TableHead>Cuartel(es)</TableHead>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Ingrediente Activo</TableHead>
                                            <TableHead>Días Transcurridos</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {processedData.length > 0 ? (
                                            processedData.map((record) => {
                                                const loteMaster = lotesMap.get(record['Lote']);
                                                const ddc = loteMaster?.fechaCianamida ? differenceInDays(record.parsedDate, loteMaster.fechaCianamida) : 'N/A';
                                                
                                                return (
                                                    <TableRow key={record.id}>
                                                        <TableCell>{format(record.parsedDate, 'dd/MM/yyyy', { locale: es })}</TableCell>
                                                        <TableCell>{ddc}</TableCell>
                                                        <TableCell>{record['Lote']}</TableCell>
                                                        <TableCell>{record.cuarteles}</TableCell>
                                                        <TableCell>{record['Producto']}</TableCell>
                                                        <TableCell>{record['Ingrediente Activo']}</TableCell>
                                                        <TableCell>{record.daysSinceLast}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center">No hay datos para los filtros seleccionados.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
