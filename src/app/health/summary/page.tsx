
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMasterData } from '@/context/MasterDataContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { format, differenceInDays, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Filter, FileDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as xlsx from 'xlsx';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';

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

const parseCustomDate = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;

    const months: { [key: string]: string } = {
        'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
    };
    
    const parts = dateString.toLowerCase().split(/[\/-]/);
    if (parts.length !== 3) return null;

    const day = parts[0];
    const monthAbbr = parts[1].substring(0, 3);
    const year = parts[2];
    
    const month = months[monthAbbr];
    if (!month) return null;

    // Try parsing as YYYY-MM-DD first for robustness
    let date = parse(`${year}-${month}-${day}`, 'yyyy-MM-dd', new Date());
    if (isValid(date)) return date;

    // Fallback to less strict parsing
    const formattedDateString = `${year}-${month}-${day}T00:00:00`;
    date = new Date(formattedDateString);

    return isValid(date) ? date : null;
};


export default function HealthSummaryPage() {
    const { toast } = useToast();
    const { lotes, loading: masterLoading } = useMasterData();
    const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const { setActions } = useHeaderActions();

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

    const handleApplyFilters = useCallback(() => {
        setActiveFilters(popoverFilters);
        setIsFilterOpen(false);
    }, [popoverFilters]);

    const handleClearFilters = useCallback(() => {
        const cleared = getInitialFilters();
        setPopoverFilters(cleared);
        setActiveFilters(cleared);
        setIsFilterOpen(false);
    }, []);

    const processedData = useMemo(() => {
        if (!activeFilters.lote || !activeFilters.objetivo) return [];

        let filtered = healthRecords.filter(r =>
            r['Lote'] === activeFilters.lote &&
            r['Objetivo'] === activeFilters.objetivo &&
            (!activeFilters.campana || r['Campaña'] === activeFilters.campana) &&
            (!activeFilters.categoria || r['Categoria'] === activeFilters.categoria)
        );

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
            parsedDate: parseCustomDate(record['Fecha Plan de Aplicación'])
        })).filter(r => r.parsedDate && isValid(r.parsedDate))
           .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());
        
        return uniqueApplications.map((record, index) => {
            let daysSinceLast = 'N/A';
            if (index > 0) {
                const prevDate = uniqueApplications[index - 1].parsedDate;
                if(prevDate && record.parsedDate) {
                  daysSinceLast = differenceInDays(record.parsedDate, prevDate).toString();
                }
            }
            return { ...record, daysSinceLast };
        }).reverse();

    }, [healthRecords, activeFilters]);

    const handleDownload = () => {
        const dataToExport = processedData.map(record => {
            const loteMaster = lotesMap.get(record['Lote']);
            let ddc = 'N/A';
            if(loteMaster?.fechaCianamida && record.parsedDate && isValid(loteMaster.fechaCianamida) && isValid(record.parsedDate)) {
              ddc = differenceInDays(record.parsedDate, loteMaster.fechaCianamida).toString();
            }
            return {
                'Fecha': record.parsedDate ? format(record.parsedDate, 'dd/MM/yyyy', { locale: es }) : 'Fecha inválida',
                'DDC': ddc,
                'Lote': record['Lote'],
                'Cuartel(es)': record.cuarteles,
                'Producto': record['Producto'],
                'Ingrediente Activo': record['Ingrediente Activo'],
                'Días Transcurridos': record.daysSinceLast,
            };
        });

        if (dataToExport.length === 0) {
            toast({ variant: "destructive", title: "Sin Datos", description: "No hay datos para exportar con los filtros actuales." });
            return;
        }

        const worksheet = xlsx.utils.json_to_sheet(dataToExport);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "ResumenSanidad");
        xlsx.writeFile(workbook, "ResumenSanidad.xlsx");
        toast({ title: "Descarga Iniciada", description: "El archivo se está descargando." });
    };

    useEffect(() => {
        setActions(
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
        );
        return () => setActions(null);
    }, [setActions, isFilterOpen, popoverFilters, filterOptions, handleApplyFilters, handleClearFilters]);

    const isContentReady = !loading && !masterLoading;

    return (
        <div className="space-y-6">
            {!isContentReady ? (
                <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : !activeFilters.lote || !activeFilters.objetivo ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground text-center mb-4">Seleccione al menos un Lote y un Objetivo para ver el resumen.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Información del Filtro</CardTitle>
                        </CardHeader>
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
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Detalle de Aplicaciones</CardTitle>
                            <Button variant="outline" size="sm" onClick={handleDownload} disabled={processedData.length === 0}>
                                <FileDown className="mr-2 h-4 w-4"/>Descargar Excel
                            </Button>
                        </CardHeader>
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
                                                let ddc = 'N/A';
                                                if(loteMaster?.fechaCianamida && record.parsedDate && isValid(loteMaster.fechaCianamida) && isValid(record.parsedDate)) {
                                                  ddc = differenceInDays(record.parsedDate, loteMaster.fechaCianamida).toString();
                                                }
                                                
                                                return (
                                                    <TableRow key={record.id}>
                                                        <TableCell>{record.parsedDate ? format(record.parsedDate, 'dd/MM/yyyy', { locale: es }) : 'Fecha Inválida'}</TableCell>
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
