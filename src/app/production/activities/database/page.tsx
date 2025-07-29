
"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback, useRef } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, getWeek, parseISO, differenceInDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ActivityRecordData, User, LoteData, Presupuesto, MinMax } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, FileDown, Filter, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteActivity } from './actions';
import EditActivityDialog from '@/components/EditActivityDialog'; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import * as xlsx from "xlsx";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useMasterData } from '@/context/MasterDataContext';


type ActivityRecordWithId = ActivityRecordData & { id: string };

interface Filters {
    campaign: string;
    lote: string;
    labor: string;
    pasada: string;
    dateRange: DateRange;
}

const getInitialFilters = (): Filters => ({
    campaign: '',
    lote: '',
    labor: '',
    pasada: '',
    dateRange: { from: undefined, to: undefined },
});

export default function ActivityDatabasePage() {
  const [data, setData] = useState<ActivityRecordWithId[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [minMax, setMinMax] = useState<MinMax[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecordWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [globalFilter, setGlobalFilter] = useState('');

  const [activeFilters, setActiveFilters] = useState<Filters>(getInitialFilters());
  const [popoverFilters, setPopoverFilters] = useState<Filters>(getInitialFilters());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const { lotes, loading: masterLoading } = useMasterData();
  const { setActions } = useHeaderActions();

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(user => {
        map.set(user.email, user);
    });
    // Add special admin user
    map.set('marcoromau@gmail.com', {
        email: 'marcoromau@gmail.com',
        nombre: 'Marco Romau',
        rol: 'Admin',
        active: true,
        dni: '00000000',
        celular: '000000000'
    });
    return map;
  }, [users]);
  
  const lotesMap = useMemo(() => {
    const map = new Map<string, LoteData>();
    lotes.forEach(lote => {
      // Create a representative entry for each unique lot number
      if (!map.has(lote.lote)) {
        map.set(lote.lote, lote);
      }
    });
    return map;
  }, [lotes]);
  
  const loteHaProdMap = useMemo(() => {
    const haMap = new Map<string, number>();
    lotes.forEach(lote => {
        const currentHa = haMap.get(lote.lote) || 0;
        haMap.set(lote.lote, currentHa + (lote.haProd || 0));
    });
    return haMap;
  }, [lotes]);
  
  const presupuestoMap = useMemo(() => {
    const map = new Map<string, Presupuesto>();
    presupuestos.forEach(p => {
        const loteKey = parseInt(p.lote, 10);
        const key = `${loteKey}-${p.descripcionLabor}`;
        map.set(key, p);
    });
    return map;
  }, [presupuestos]);

  const minMaxMap = useMemo(() => {
    const map = new Map<string, MinMax>();
    minMax.forEach(item => {
      const key = `${item.campana}-${item.lote}-${item.codigo}-${item.pasada}`;
      map.set(key, item);
    });
    return map;
  }, [minMax]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const usersPromise = getDocs(collection(db, "usuarios"));
    const presupuestoPromise = getDocs(collection(db, "presupuesto"));
    const minMaxPromise = getDocs(collection(db, "min-max"));

    try {
        const [usersSnapshot, presupuestoSnapshot, minMaxSnapshot] = await Promise.all([usersPromise, presupuestoPromise, minMaxPromise]);

        const usersData = usersSnapshot.docs.map(doc => ({...doc.data(), id: doc.id }) as User);
        setUsers(usersData);
        
        const presupuestoData = presupuestoSnapshot.docs.map(doc => ({...doc.data(), id: doc.id }) as Presupuesto);
        setPresupuestos(presupuestoData);
        
        const minMaxData = minMaxSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MinMax));
        setMinMax(minMaxData);

    } catch (error) {
        console.error("Error fetching related data: ", error);
        toast({ title: "Error", description: "No se pudieron cargar los datos de usuarios, presupuesto o min-max.", variant: "destructive" });
    }

    const q = query(collection(db, "actividades"), orderBy("registerDate", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => {
        const docData = doc.data();
        let registerDate: Date;
        if (docData.registerDate?.toDate) {
            registerDate = docData.registerDate.toDate();
        } else if (typeof docData.registerDate === 'string') {
            registerDate = parseISO(docData.registerDate);
        } else {
            registerDate = new Date();
        }
        return { ...docData, id: doc.id, registerDate } as ActivityRecordWithId;
      });
      setData(recordsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching activities: ", error);
      toast({
        title: "Error de Conexión",
        description: "No se pudieron cargar los registros.",
        variant: "destructive"
      });
      setLoading(false);
    });

    return unsubscribe;
  }, [toast]);
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    const initFetch = async () => {
      unsubscribe = await fetchData();
    };
    
    initFetch();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchData]);

  const cumulativeJrHaMap = useMemo(() => {
    const cumulativeMap = new Map<string, number>();
    const tempTotals = new Map<string, number>();

    // Sort data chronologically (oldest first) to calculate cumulative sum correctly
    const sortedData = [...data].sort((a, b) => a.registerDate.getTime() - b.registerDate.getTime());

    sortedData.forEach(item => {
        const key = `${item.lote}-${item.labor}`;
        const totalHaProdForLote = loteHaProdMap.get(item.lote) || 0;
        const jrHa = totalHaProdForLote > 0 ? (item.workdayCount || 0) / totalHaProdForLote : 0;
        
        const currentCumulative = tempTotals.get(key) || 0;
        const newCumulative = currentCumulative + jrHa;
        
        tempTotals.set(key, newCumulative);
        cumulativeMap.set(item.id, newCumulative);
    });

    return cumulativeMap;
  }, [data, loteHaProdMap]);

  const handleEdit = (activity: ActivityRecordWithId) => {
    setSelectedActivity(activity);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
        const result = await deleteActivity(id);
        if (result.success) {
            toast({ title: "Éxito", description: "Actividad eliminada correctamente." });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.message });
        }
    });
  };

  const filterOptions = useMemo(() => {
      const campaigns = [...new Set(data.map(item => item.campaign))].sort();
      const lotesOptions = [...new Set(data.map(item => item.lote))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
      const labors = [...new Set(data.map(item => item.labor).filter(Boolean) as string[])].sort();
      const pasadas = [...new Set(data.map(item => String(item.pass)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
      return { campaigns, lotes: lotesOptions, labors, pasadas };
  }, [data]);

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

  const filteredData = useMemo(() => {
    return data.filter(item => {
        const lowerGlobalFilter = globalFilter.toLowerCase();
        const matchesGlobal = globalFilter ? 
            (item.labor?.toLowerCase().includes(lowerGlobalFilter) || 
             item.lote?.toLowerCase().includes(lowerGlobalFilter) ||
             item.campaign?.toLowerCase().includes(lowerGlobalFilter))
            : true;

        const matchesCampaign = activeFilters.campaign ? item.campaign === activeFilters.campaign : true;
        const matchesLote = activeFilters.lote ? item.lote === activeFilters.lote : true;
        const matchesLabor = activeFilters.labor ? item.labor === activeFilters.labor : true;
        const matchesPasada = activeFilters.pasada ? String(item.pass) === activeFilters.pasada : true;
        
        const itemDate = item.registerDate;
        const fromDate = activeFilters.dateRange?.from;
        const toDate = activeFilters.dateRange?.to;
        const matchesDate = 
            (!fromDate || itemDate >= fromDate) && 
            (!toDate || itemDate <= toDate);
            
        return matchesGlobal && matchesCampaign && matchesLote && matchesLabor && matchesPasada && matchesDate;
    });
  }, [data, globalFilter, activeFilters]);
  
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
        if (loteData && loteData.fechaCianamida && isValid(loteData.fechaCianamida) && isValid(row.original.registerDate)) {
            return differenceInDays(row.original.registerDate, loteData.fechaCianamida);
        }
        return 'N/A';
    }},
    { header: 'var', cell: ({row}) => lotesMap.get(row.original.lote)?.variedad || 'N/A' },
    { header: 'Cod Lote', accessorKey: 'lote' },
    { header: 'COD. LABOR', accessorKey: 'code' },
    { header: 'Labor', accessorKey: 'labor' },
    { header: 'Asistente', cell: ({ row }) => {
        const user = userMap.get(row.original.createdBy);
        if (user && user.rol === 'Asistente') {
            return user.nombre;
        }
        return 'N/A';
    } },
    { header: 'JR presup.', cell: ({ row }) => {
        const loteKey = parseInt(row.original.lote, 10);
        const key = `${loteKey}-${row.original.labor}`;
        const presupuesto = presupuestoMap.get(key);
        return presupuesto ? presupuesto.jrnHa : '0';
    }},
    { header: 'JHU/Ha', cell: ({ row }) => {
        const cumulativeJrHa = cumulativeJrHaMap.get(row.original.id);
        return cumulativeJrHa !== undefined ? cumulativeJrHa.toFixed(2) : '0.00';
    }},
    { header: 'Saldo', cell: ({row}) => {
        const loteKey = parseInt(row.original.lote, 10);
        const key = `${loteKey}-${row.original.labor}`;
        const presupuesto = presupuestoMap.get(key);
        const jrPresup = presupuesto ? Number(presupuesto.jrnHa) : 0;
        
        const jhuHa = cumulativeJrHaMap.get(row.original.id) || 0;
        
        const saldo = jrPresup - jhuHa;
        
        const saldoClassName = saldo < 0 ? 'text-red-600 font-bold' : 'text-blue-600';
        
        return <span className={saldoClassName}>{saldo.toFixed(2)}</span>;
    }},
    { header: 'N° Pasada', accessorKey: 'pass' },
    { header: 'JR/Ha', cell: ({ row }) => {
        const totalHaProdForLote = loteHaProdMap.get(row.original.lote) || 0;
        if (totalHaProdForLote === 0) return '0.00';
        
        const jhu = row.original.workdayCount || 0;
        const result = jhu / totalHaProdForLote;
        return result.toFixed(2);
    }},
    { header: 'Rdto total', accessorKey: 'performance', cell: ({ row }) => row.original.performance?.toLocaleString('en-US') || '0' },
    { header: 'Area Avanzada', cell: ({row}) => {
      const loteData = lotesMap.get(row.original.lote);
      const densidad = loteData?.densidad || 0;
      const performance = row.original.performance || 0;
      if (densidad > 0) {
        return (performance / densidad).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return '0.00';
    }},
    { header: 'Racimo o jabas', cell: () => '0' },
    { header: 'Min Estab.', cell: ({ row }) => {
        const { campaign, lote, code, pass } = row.original;
        const key = `${campaign}-${lote}-${code}-${pass}`;
        const record = minMaxMap.get(key);
        return record ? record.min : 'N/A';
    }},
    { header: 'Max Estab.', cell: ({ row }) => {
        const { campaign, lote, code, pass } = row.original;
        const key = `${campaign}-${lote}-${code}-${pass}`;
        const record = minMaxMap.get(key);
        return record ? record.max : 'N/A';
    }},
    { header: 'Min', accessorKey: 'minRange' },
    { header: 'Max', accessorKey: 'maxRange' },
    { header: 'Personas', accessorKey: 'personnelCount' },
    { header: 'JHU', accessorKey: 'workdayCount' },
    { header: 'Costo Plta, Jaba, Racimo', accessorKey: 'cost', cell: ({ row }) => `S/ ${row.original.cost?.toLocaleString('en-US') || '0.00'}` },
    { header: 'TURNO', accessorKey: 'shift' },
    { header: 'Prom./ Jhu', cell: () => '0' },
    { header: 'Prom./ Persona', cell: () => '0' },
    { header: 'costo por planta', cell: () => '0' },
    { header: 'costo plta emp.', cell: () => '0' },
    { header: 'Pago Neto Prom. / JHU', cell: () => '0' },
    { header: 'Costo Labor', cell: () => '0' },
    { header: 'Costo Empresa', cell: () => '0' },
    { header: 'Usuario', cell: ({ row }) => userMap.get(row.original.createdBy)?.nombre || row.original.createdBy },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90">
                    <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará el registro permanentemente.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(row.original.id)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ], [userMap, lotesMap, loteHaProdMap, presupuestoMap, cumulativeJrHaMap, minMaxMap]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
        globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  
  const handleDownload = useCallback(() => {
        if (!table) return;
        const dataToExport = table.getRowModel().rows.map(row => {
            const { id, createdBy, ...rest } = row.original;
            return {
                Fecha: format(rest.registerDate, 'dd/MM/yyyy'),
                Campaña: rest.campaign,
                Etapa: rest.stage,
                Lote: rest.lote,
                'Cód.': rest.code,
                Labor: rest.labor,
                Rendimiento: rest.performance,
                '# Pers.': rest.personnelCount,
                '# Jorn.': rest.workdayCount,
                'Costo (S/)': rest.cost,
                Turno: rest.shift,
                Pasada: rest.pass,
                Min: rest.minRange,
                Max: rest.maxRange,
                Observaciones: rest.observations,
                Usuario: userMap.get(createdBy)?.nombre || createdBy,
            };
        });
        const worksheet = xlsx.utils.json_to_sheet(dataToExport);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Actividades");
        xlsx.writeFile(workbook, "BaseDeActividades.xlsx");
    }, [table, userMap]);

    useEffect(() => {
      const handleActions = () => {
        setActions(
          <>
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Filter className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                  <div className="grid gap-4">
                      <div className="space-y-2"><h4 className="font-medium leading-none">Filtros Avanzados</h4></div>
                      <div className="grid gap-2">
                          <div className="grid grid-cols-3 items-center gap-4">
                              <Label>Campaña</Label>
                              <Select onValueChange={(v) => setPopoverFilters(p => ({...p, campaign: v === 'all' ? '' : v}))} value={popoverFilters.campaign}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                          </div>
                          <div className="grid grid-cols-3 items-center gap-4">
                              <Label>Lote</Label>
                              <Select onValueChange={(v) => setPopoverFilters(p => ({...p, lote: v === 'all' ? '' : v}))} value={popoverFilters.lote}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                          </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                              <Label>Labor</Label>
                              <Select onValueChange={(v) => setPopoverFilters(p => ({...p, labor: v === 'all' ? '' : v}))} value={popoverFilters.labor}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                          </div>
                           <div className="grid grid-cols-3 items-center gap-4">
                              <Label>Pasada</Label>
                              <Select onValueChange={(v) => setPopoverFilters(p => ({...p, pasada: v === 'all' ? '' : v}))} value={popoverFilters.pasada}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.pasadas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                          </div>
                          <div className="grid grid-cols-1 items-center gap-2">
                              <Label>Fecha</Label>
                              <Popover>
                              <PopoverTrigger asChild>
                                  <Button id="date" variant={'outline'} className={cn('w-full justify-start text-left font-normal h-8', !popoverFilters.dateRange.from && 'text-muted-foreground' )}>
                                      <CalendarIcon className="mr-2 h-4 w-4" />
                                      {popoverFilters.dateRange?.from ? (popoverFilters.dateRange.to ? (<>{format(popoverFilters.dateRange.from, 'LLL dd, y', { locale: es })} - {format(popoverFilters.dateRange.to, 'LLL dd, y', { locale: es })}</>) : (format(popoverFilters.dateRange.from, 'LLL dd, y', { locale: es }))) : (<span>Seleccione un rango</span>)}
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar initialFocus mode="range" defaultMonth={popoverFilters.dateRange?.from} selected={popoverFilters.dateRange} onSelect={(range) => setPopoverFilters(p => ({...p, dateRange: range || {from: undefined, to: undefined}}))} numberOfMonths={1} locale={es} />
                              </PopoverContent>
                              </Popover>
                          </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                          <Button variant="ghost" size="sm" onClick={handleClearFilters}>Limpiar</Button>
                          <Button size="sm" onClick={handleApplyFilters}>Aplicar</Button>
                      </div>
                  </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={handleDownload} disabled={table.getRowModel().rows.length === 0} className="h-9 w-9">
              <FileDown className="h-5 w-5" />
            </Button>
          </>
        );
      };
      handleActions();
      return () => setActions(null);
    }, [setActions, isFilterOpen, popoverFilters, filterOptions, table, handleDownload, handleApplyFilters, handleClearFilters]);

  
    return (
      <div className="flex flex-col h-full space-y-4">
        <Input
            placeholder="Buscar por labor, lote, campaña..."
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="w-full sm:max-w-sm h-9"
        />
        
        <div className="flex-1 rounded-lg border overflow-x-auto min-h-0">
          <Table>
              <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="whitespace-nowrap px-3 py-2 text-xs">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                  ))}
                  </TableRow>
              ))}
              </TableHeader>
              <TableBody>
              {(loading || masterLoading) ? (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
              ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>{row.getVisibleCells().map((cell) => (<TableCell key={cell.id} className="whitespace-nowrap px-3 py-2 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>
                  ))
              ) : (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No se encontraron registros.</TableCell></TableRow>
              )}
              </TableBody>
          </Table>
        </div>
  
        <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                  Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              </span>
            <div className="flex items-center gap-2">
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
              >
                  <ChevronLeft className="h-4 w-4 mr-1"/>
                  Anterior
              </Button>
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
              >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1"/>
              </Button>
            </div>
        </div>
         {selectedActivity && (
              <EditActivityDialog
                  isOpen={isEditDialogOpen}
                  onOpenChange={setIsEditDialogOpen}
                  activity={selectedActivity}
                  onSuccess={() => {
                      setIsEditDialogOpen(false);
                      setSelectedActivity(null);
                  }}
              />
          )}
      </div>
    );
  }
  
      

    




    

    




