"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, getWeek, parseISO, differenceInDays, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ActivityRecordData, User, LoteData, Presupuesto, MinMax, Assistant } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Pencil, 
  Trash2, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  FileDown, 
  Filter, 
  Calendar as CalendarIcon, 
  RefreshCcw 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EditActivityDialog from '@/components/EditActivityDialog'; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import * as xlsx from "xlsx";
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useMasterData } from '@/context/MasterDataContext';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

type ActivityRecordWithId = ActivityRecordData & { id: string, Variety?: string, budgetJrnHa?: number, minEstablished?: number, maxEstablished?: number };

interface Filters {
    campaign: string;
    stage: string;
    lote: string;
    labor: string;
    pass: string;
    dateRange?: DateRange;
}

const getInitialFilters = (): Filters => ({
    campaign: '',
    stage: '',
    lote: '',
    labor: '',
    pass: '',
    dateRange: { from: undefined, to: undefined },
});

// Define calculation functions BEFORE the component to avoid ReferenceError
const calculateCostoLabor = (reg: ActivityRecordWithId): number => {
  const cost = reg.cost || 0;
  const specialLabors = ['46', '67'];
  const isSpecial = specialLabors.includes(reg.code || '');
  const numerator = isSpecial ? (reg.clustersOrJabas || 0) : (reg.performance || 0);
  if (cost === 0) return (reg.workdayCount || 0) * 60;
  return numerator * cost;
};

const calculatePromJhu = (reg: ActivityRecordWithId): number => {
  const specialLabors = ['46', '67'];
  const isSpecial = specialLabors.includes(reg.code || '');
  const numerator = isSpecial ? (reg.clustersOrJabas || 0) : (reg.performance || 0);
  const jhu = reg.workdayCount || 0;
  if (jhu === 0) return 0;
  return numerator / jhu;
};

export default function ActivityDatabasePage() {
  const { toast } = useToast();
  const [data, setData] = useState<ActivityRecordWithId[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecordWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  
  const { lotes, asistentes, presupuestos, minMax, loading: masterLoading } = useMasterData();
  const { setActions } = useHeaderActions();

  const [globalFilter, setGlobalFilter] = useState('');
  const [activeFilters, setActiveFilters] = useState<Filters>(getInitialFilters());
  const [popoverFilters, setPopoverFilters] = useState<Filters>(getInitialFilters());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
        const [usersSnapshot, activitiesSnapshot] = await Promise.all([
            getDocs(collection(db, "usuarios")),
            getDocs(query(collection(db, "actividades"), orderBy("registerDate", "desc")))
        ]);
        setUsers(usersSnapshot.docs.map(doc => ({...doc.data(), id: doc.id }) as User));
        setData(activitiesSnapshot.docs.map(doc => {
            const docData = doc.data();
            let registerDate: Date = docData.registerDate?.toDate ? docData.registerDate.toDate() : (typeof docData.registerDate === 'string' ? parseISO(docData.registerDate) : new Date());
            return { ...docData, id: doc.id, registerDate } as ActivityRecordWithId;
        }));
    } catch (error) {
        console.error("Error fetching data: ", error);
        toast({ title: "Error de Conexión", description: "No se pudieron cargar los registros.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Memoize maps BEFORE using them in columns
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(user => { if(user.email) map.set(user.email, user); });
    map.set('marcoromau@gmail.com', { nombre: 'Marco Romau', email: 'marcoromau@gmail.com' } as any);
    return map;
  }, [users]);

  const assistantMap = useMemo(() => {
    const map = new Map<string, Assistant>();
    asistentes.forEach(a => map.set(a.id, a as any));
    return map;
  }, [asistentes]);
  
  const lotesMap = useMemo(() => {
    const map = new Map<string, LoteData>();
    lotes.forEach(lote => { if (!map.has(lote.lote)) map.set(lote.lote, lote); });
    return map;
  }, [lotes]);
  
  const loteHaProdMap = useMemo(() => {
    const haMap = new Map<string, number>();
    lotes.forEach(lote => { const currentHa = haMap.get(lote.lote) || 0; haMap.set(lote.lote, currentHa + (lote.haProd || 0)); });
    return haMap;
  }, [lotes]);
  
  const presupuestoMap = useMemo(() => {
    const map = new Map<string, Presupuesto>();
    presupuestos.forEach(p => { const key = `${p.lote}-${p.descripcionLabor}-${p.campana}`; map.set(key, p); });
    return map;
  }, [presupuestos]);

  const minMaxMap = useMemo(() => {
    const map = new Map<string, MinMax>();
    minMax.forEach(item => { const key = `${item.campana}-${item.lote}-${item.codigo}-${item.pasada}`; map.set(key, item); });
    return map;
  }, [minMax]);

  const cumulativeJrHaMap = useMemo(() => {
    const mapResult = new Map<string, number>();
    const tempTotals = new Map<string, number>();
    const sortedData = [...data].sort((a, b) => a.registerDate.getTime() - b.registerDate.getTime());
    sortedData.forEach(item => {
        const key = `${item.lote}-${item.labor}`;
        const totalHaProd = loteHaProdMap.get(item.lote) || 0;
        const jrHa = totalHaProd > 0 ? (item.workdayCount || 0) / totalHaProd : 0;
        const currentCumulative = tempTotals.get(key) || 0;
        const nCumulative = currentCumulative + jrHa;
        tempTotals.set(key, nCumulative);
        mapResult.set(item.id, nCumulative);
    });
    return mapResult;
  }, [data, loteHaProdMap]);

  const columns = useMemo<ColumnDef<ActivityRecordWithId>[]>(() => [
    { header: 'Año', cell: ({ row }) => format(row.original.registerDate, 'yyyy')},
    { header: 'Mes', cell: ({ row }) => format(row.original.registerDate, 'LLL', { locale: es }).replace('.','') },
    { header: 'Dia', cell: ({ row }) => format(row.original.registerDate, 'E', { locale: es }).replace('.','') },
    { header: 'Sem.', cell: ({ row }) => getWeek(row.original.registerDate, { weekStartsOn: 1, locale: es })},
    { header: 'Fecha', cell: ({ row }) => format(row.original.registerDate, 'dd/MM/yyyy')},
    { header: 'PROYEC.', accessorKey: 'stage' },
    { header: 'CAMPAÑA', accessorKey: 'campaign' },
    { header: 'DDC', cell: ({ row }) => {
        const loteData = lotesMap.get(row.original.lote);
        if (loteData?.fechaCianamida && isValid(loteData.fechaCianamida) && isValid(row.original.registerDate)) {
            const cianDate = loteData.fechaCianamida instanceof Date ? loteData.fechaCianamida : parseISO(loteData.fechaCianamida as any);
            return differenceInDays(row.original.registerDate, cianDate);
        }
        return 'N/A';
    }},
    { header: 'var', cell: ({row}) => row.original.Variety || row.original.variedad || lotesMap.get(row.original.lote)?.variedad || 'N/A' },
    { header: 'Asistente', cell: ({ row }) => row.original.assistantName || assistantMap.get(row.original.assistantDni || '')?.assistantName || row.original.assistantDni || 'N/A' },
    { header: 'Cod Lote', accessorKey: 'lote' },
    { header: 'COD. LABOR', accessorKey: 'code' },
    { header: 'Labor', accessorKey: 'labor' },
    { header: 'JR presup.', cell: ({ row }) => {
        if (row.original.budgetJrnHa !== undefined) return row.original.budgetJrnHa;
        const key = `${row.original.lote}-${row.original.labor}-${row.original.campaign}`;
        return presupuestoMap.get(key)?.jrnHa || '0';
    }},
    { header: 'JHU/Ha', cell: ({ row }) => cumulativeJrHaMap.get(row.original.id)?.toFixed(2) || '0.00' },
    { header: 'Saldo', cell: ({row}) => {
        const jrPresup = row.original.budgetJrnHa ?? Number(presupuestoMap.get(`${row.original.lote}-${row.original.labor}-${row.original.campaign}`)?.jornadas || 0);
        const saldo = jrPresup - (cumulativeJrHaMap.get(row.original.id) || 0);
        return <span className={saldo < 0 ? 'text-red-600 font-bold' : 'text-blue-600'}>{saldo.toFixed(2)}</span>;
    }},
    { header: 'N° Pasada', accessorKey: 'pass' },
    { header: 'JR/Ha', cell: ({ row }) => {
        const totalHa = loteHaProdMap.get(row.original.lote) || 0;
        return totalHa === 0 ? '0.00' : ((row.original.workdayCount || 0) / totalHa).toFixed(2);
    }},
    { header: 'Rdto total', accessorKey: 'performance', cell: ({ row }) => row.original.performance?.toLocaleString('en-US') || '0' },
    { header: 'Area Avanzada', cell: ({row}) => {
      const densidad = lotesMap.get(row.original.lote)?.densidad || 0;
      return densidad > 0 ? ((row.original.performance || 0) / densidad).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    }},
    { header: 'Racimo o jabas', cell: ({ row }) => row.original.clustersOrJabas?.toLocaleString('en-US') || '0' },
    { header: 'Min Estab.', cell: ({ row }) => row.original.minEstablished ?? minMaxMap.get(`${row.original.campaign}-${row.original.lote}-${row.original.code}-${row.original.pass}`)?.min ?? 'N/A' },
    { header: 'Max Estab.', cell: ({ row }) => row.original.maxEstablished ?? minMaxMap.get(`${row.original.campaign}-${row.original.lote}-${row.original.code}-${row.original.pass}`)?.max ?? 'N/A' },
    { header: 'Min', accessorKey: 'minRange' },
    { header: 'Max', accessorKey: 'maxRange' },
    { header: 'Personas', accessorKey: 'personnelCount' },
    { header: 'JHU', accessorKey: 'workdayCount' },
    { header: 'Costo (S/)', accessorKey: 'cost', cell: ({ row }) => `S/ ${row.original.cost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}` },
    { header: 'TURNO', accessorKey: 'shift' },
    { header: 'Prom./ Jhu', cell: ({ row }) => calculatePromJhu(row.original).toFixed(2) },
    { header: 'Prom./ Persona', cell: ({ row }) => {
        const personas = row.original.personnelCount || 0;
        if (personas === 0) return '0.00';
        const isSpecial = ['46', '67'].includes(row.original.code || '');
        return ((isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0)) / personas).toFixed(2);
    } },
    { header: 'Costo p/ Planta', cell: ({ row }) => {
        const isSpecial = ['46', '67'].includes(row.original.code || '');
        const divisor = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);
        return `S/ ${divisor > 0 ? (calculateCostoLabor(row.original) / divisor).toFixed(2) : '0.00'}`;
    } },
    { header: 'Costo Labor', cell: ({ row }) => `S/ ${calculateCostoLabor(row.original).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    { header: 'Obs.', accessorKey: 'observations' },
    { header: 'Usuario', cell: ({ row }) => userMap.get(row.original.createdBy || '')?.nombre || row.original.createdBy },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(row.original)}><Pencil className="h-4 w-4" /></Button>
          <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(row.original.id)}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ], [userMap, lotesMap, loteHaProdMap, presupuestoMap, cumulativeJrHaMap, minMaxMap, assistantMap]);

  useEffect(() => { setActions({ title: "Base de Datos de Actividades", right: <Button onClick={() => fetchData()} disabled={loading} variant="ghost" size="icon"><RefreshCcw className="h-5 w-5"/></Button> }); return () => setActions({}); }, [setActions, fetchData, loading]);

  const handleEdit = (activity: ActivityRecordWithId) => { setSelectedActivity(activity); setIsEditDialogOpen(true); };
  const handleDelete = (id: string) => { startTransition(async () => { try { await deleteDoc(doc(db, 'actividades', id)); toast({ title: "Éxito", description: "Actividad eliminada correctamente." }); setData(prev => prev.filter(item => item.id !== id)); } catch(e) { toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la actividad." }); } }); };

  const filteredData = useMemo(() => {
    let filtered = data;
    if (globalFilter) {
      const lowFilter = globalFilter.toLowerCase();
      filtered = filtered.filter(item => item.labor?.toLowerCase().includes(lowFilter) || item.lote?.toLowerCase().includes(lowFilter) || item.campaign?.toLowerCase().includes(lowFilter));
    }
    if (activeFilters.campaign) filtered = filtered.filter(item => item.campaign === activeFilters.campaign);
    if (activeFilters.stage) filtered = filtered.filter(item => item.stage === activeFilters.stage);
    if (activeFilters.lote) filtered = filtered.filter(item => item.lote === activeFilters.lote);
    if (activeFilters.labor) filtered = filtered.filter(item => item.labor === activeFilters.labor);
    if (activeFilters.pass) filtered = filtered.filter(item => String(item.pass) === activeFilters.pass);
    if (activeFilters.dateRange?.from) filtered = filtered.filter(item => item.registerDate >= startOfDay(activeFilters.dateRange!.from!));
    if (activeFilters.dateRange?.to) filtered = filtered.filter(item => item.registerDate <= startOfDay(activeFilters.dateRange!.to!));
    return filtered;
  }, [data, globalFilter, activeFilters]);

  const table = useReactTable({ data: filteredData, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), getFilteredRowModel: getFilteredRowModel(), initialState: { pagination: { pageSize: 50 } } });
  
  const handleDownload = () => {
    const rows = table.getRowModel().rows;
    if (rows.length === 0) return;
    const exportData = rows.map(row => {
      const { id, Variety, budgetJrnHa, minEstablished, maxEstablished, createdBy, ...rest } = row.original;
      return { Fecha: format(rest.registerDate, 'dd/MM/yyyy'), Campaña: rest.campaign, Etapa: rest.stage, Lote: rest.lote, Variedad: Variety || rest.variedad || lotesMap.get(rest.lote)?.variedad || 'N/A', 'Cód.': rest.code, Labor: rest.labor, Rendimiento: rest.performance, '# Pers.': rest.personnelCount, '# Jorn.': rest.workdayCount, 'Costo (S/)': rest.cost, Turno: rest.shift, Pasada: rest.pass, 'Presupuesto/Ha': budgetJrnHa || 'N/A', 'Min Estab.': minEstablished || 'N/A', 'Max Estab.': maxEstablished || 'N/A', Min: rest.minRange, Max: rest.maxRange, Observaciones: rest.observations, Asistente: rest.assistantName || assistantMap.get(rest.assistantDni || '')?.assistantName || rest.assistantDni, Usuario: userMap.get(createdBy || '')?.nombre || createdBy };
    });
    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Actividades");
    xlsx.writeFile(wb, "BaseDeActividades.xlsx");
  };

  return (
    <div className="flex flex-col h-full space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <Input id="global-search-input" name="global-search-input" placeholder="Buscar por labor, lote..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="w-full sm:max-w-sm h-9" />
            <div className="flex items-center gap-2">
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-9"><Filter className="mr-2 h-4 w-4" /> Filtros</Button></PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                        <div className="grid gap-4">
                            <h4 className="font-medium leading-none">Filtros Avanzados</h4>
                            <div className="grid gap-2">
                                <Label htmlFor="campaign-filter-select">Campaña</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, campaign: v === 'all' ? '' : v}))} value={popoverFilters.campaign}><SelectTrigger id="campaign-filter-select" name="campaign-filter-select"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{[...new Set(data.map(i => i.campaign).filter(Boolean))].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                <Label htmlFor="lote-filter-select">Lote</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, lote: v === 'all' ? '' : v}))} value={popoverFilters.lote}><SelectTrigger id="lote-filter-select" name="lote-filter-select"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{[...new Set(data.map(i => i.lote).filter(Boolean))].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                <Label htmlFor="date-range-filter">Rango de Fecha</Label>
                                <Popover><PopoverTrigger asChild><Button id="date-range-filter" name="date-range-filter" variant={'outline'} className={cn('w-full justify-start text-left font-normal h-9', !popoverFilters.dateRange?.from && 'text-muted-foreground' )}><CalendarIcon className="mr-2 h-4 w-4" /> {popoverFilters.dateRange?.from ? (popoverFilters.dateRange.to ? (<>{format(popoverFilters.dateRange.from, 'LLL dd', { locale: es })} - {format(popoverFilters.dateRange.to, 'LLL dd', { locale: es })}</>) : (format(popoverFilters.dateRange.from, 'LLL dd', { locale: es }))) : (<span>Seleccione rango</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar initialFocus mode="range" selected={popoverFilters.dateRange} onSelect={(r) => setPopoverFilters(p => ({...p, dateRange: r}))} locale={es}/></PopoverContent></Popover>
                            </div>
                            <div className="flex justify-between items-center pt-2"><Button variant="ghost" size="sm" onClick={() => { const cl = getInitialFilters(); setPopoverFilters(cl); setActiveFilters(cl); setIsFilterOpen(false); }}>Limpiar</Button><Button size="sm" onClick={() => { setActiveFilters(popoverFilters); setIsFilterOpen(false); }}>Aplicar</Button></div>
                        </div>
                    </PopoverContent>
                </Popover>
                <Button onClick={handleDownload} disabled={table.getRowModel().rows.length === 0} size="sm" className="h-9"><FileDown className="h-4 w-4 mr-2" /> Descargar</Button>
            </div>
        </div>
        <div className="flex-1 rounded-lg border overflow-x-auto min-h-0"><Table><TableHeader>{table.getHeaderGroups().map((hg) => (<TableRow key={hg.id}>{hg.headers.map((h) => (<TableHead key={h.id} className="whitespace-nowrap px-3 py-2 text-xs">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>))}</TableRow>))}</TableHeader><TableBody>{(loading || masterLoading) ? (<TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>) : table.getRowModel().rows?.length ? (table.getRowModel().rows.map((row) => (<TableRow key={row.id}>{row.getVisibleCells().map((cell) => (<TableCell key={cell.id} className="whitespace-nowrap px-3 py-2 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>))) : (<TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No se encontraron registros.</TableCell></TableRow>)}</TableBody></Table></div>
        <div className="flex items-center justify-between gap-2 flex-wrap"><div className="flex items-center gap-2"><Select value={`${table.getState().pagination.pageSize}`} onValueChange={(v) => table.setPageSize(Number(v))}><SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Mostrar..." /></SelectTrigger><SelectContent>{[10, 20, 50, 100, 500].map((ps) => (<SelectItem key={ps} value={`${ps}`}>Mostrar {ps}</SelectItem>))}</SelectContent></Select><span className="text-sm text-muted-foreground whitespace-nowrap">Fila {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}-{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} de {table.getFilteredRowModel().rows.length}</span></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="h-9 w-9 p-0"><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-9 px-3"><ChevronLeft className="h-4 w-4 mr-1" /> Ant.</Button><span className="text-sm font-medium">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span><Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-9 px-3">Sig. <ChevronRight className="h-4 w-4 ml-1" /></Button><Button variant="outline" size="sm" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="h-9 w-9 p-0"><ChevronsRight className="h-4 w-4" /></Button></div></div>
        {selectedActivity && (<EditActivityDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} activity={selectedActivity} onSuccess={() => { setIsEditDialogOpen(false); setSelectedActivity(null); fetchData(); }} />)}
    </div>
  );
}