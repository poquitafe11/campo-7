
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
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ActivityRecordData, User } from '@/lib/types';
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


type ActivityRecordWithId = ActivityRecordData & { id: string };

interface Filters {
    campaign: string;
    lote: string;
    labor: string;
    dateRange: DateRange;
}

const getInitialFilters = (): Filters => ({
    campaign: '',
    lote: '',
    labor: '',
    dateRange: { from: undefined, to: undefined },
});

export default function ActivityDatabasePage() {
  const [data, setData] = useState<ActivityRecordWithId[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecordWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [globalFilter, setGlobalFilter] = useState('');

  const [activeFilters, setActiveFilters] = useState<Filters>(getInitialFilters());
  const [popoverFilters, setPopoverFilters] = useState<Filters>(getInitialFilters());
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(user => {
        map.set(user.email, user.nombre);
    });
    map.set('marcoromau@gmail.com', 'Marco Romau');
    return map;
  }, [users]);
  
  const fetchData = useCallback(() => {
    setLoading(true);
    const q = query(collection(db, "actividades"), orderBy("registerDate", "desc"));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const recordsData = snapshot.docs.map(doc => {
        const docData = doc.data();
        const registerDate = docData.registerDate?.toDate ? docData.registerDate.toDate() : new Date();
        return { ...docData, id: doc.id, registerDate } as ActivityRecordWithId;
      });
      setData(recordsData);

      try {
        const usersSnapshot = await getDocs(collection(db, "usuarios"));
        const usersData = usersSnapshot.docs.map(doc => doc.data() as User);
        setUsers(usersData);
      } catch (userError) {
         console.error("Error fetching users: ", userError);
      }
      setLoading(false);

    }, (error) => {
      console.error("Error fetching data from Firestore: ", error);
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
    const unsubscribe = fetchData();
    return () => unsubscribe();
  }, [fetchData]);

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
      const lotes = [...new Set(data.map(item => item.lote))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
      const labors = [...new Set(data.map(item => item.labor).filter(Boolean) as string[])].sort();
      return { campaigns, lotes, labors };
  }, [data]);

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

  const filteredData = useMemo(() => {
    return data.filter(item => {
        // Global text filter
        const lowerGlobalFilter = globalFilter.toLowerCase();
        const matchesGlobal = globalFilter ? 
            (item.labor?.toLowerCase().includes(lowerGlobalFilter) || 
             item.lote?.toLowerCase().includes(lowerGlobalFilter) ||
             item.campaign?.toLowerCase().includes(lowerGlobalFilter))
            : true;

        // Advanced filters
        const matchesCampaign = activeFilters.campaign ? item.campaign === activeFilters.campaign : true;
        const matchesLote = activeFilters.lote ? item.lote === activeFilters.lote : true;
        const matchesLabor = activeFilters.labor ? item.labor === activeFilters.labor : true;
        
        const itemDate = item.registerDate;
        const fromDate = activeFilters.dateRange?.from;
        const toDate = activeFilters.dateRange?.to;
        const matchesDate = 
            (!fromDate || itemDate >= fromDate) && 
            (!toDate || itemDate <= toDate);
            
        return matchesGlobal && matchesCampaign && matchesLote && matchesLabor && matchesDate;
    });
  }, [data, globalFilter, activeFilters]);

  const handleDownload = () => {
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
              Usuario: userMap.get(createdBy) || createdBy,
          };
      });
      const worksheet = xlsx.utils.json_to_sheet(dataToExport);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Actividades");
      xlsx.writeFile(workbook, "BaseDeActividades.xlsx");
  };

  const columns = useMemo<ColumnDef<ActivityRecordWithId>[]>(() => [
    {
      accessorKey: 'registerDate',
      header: 'Fecha',
      cell: ({ row }) => format(row.original.registerDate, 'dd/MM/yyyy', { locale: es }),
    },
    { accessorKey: 'campaign', header: 'Campaña' },
    { accessorKey: 'stage', header: 'Etapa' },
    { accessorKey: 'lote', header: 'Lote' },
    { accessorKey: 'code', header: 'Cód.' },
    { 
      accessorKey: 'labor', 
      header: 'Labor',
      cell: ({ row }) => <div className="min-w-[200px] truncate">{row.original.labor}</div>
    },
    { accessorKey: 'performance', header: 'Rendimiento' },
    { accessorKey: 'personnelCount', header: '# Pers.' },
    { accessorKey: 'workdayCount', header: '# Jorn.' },
    { 
      accessorKey: 'cost', 
      header: 'Costo (S/)',
      cell: ({ row }) => `S/ ${row.original.cost.toFixed(2)}`
    },
    { accessorKey: 'shift', header: 'Turno' },
    { accessorKey: 'pass', header: 'Pasada' },
    { accessorKey: 'minRange', header: 'Min' },
    { accessorKey: 'maxRange', header: 'Max' },
    { 
        accessorKey: 'createdBy', 
        header: 'Usuario',
        cell: ({ row }) => {
            const email = row.original.createdBy;
            const name = userMap.get(email);
            return <div className="min-w-[150px] truncate">{name || email}</div>
        }
    },
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
  ], [userMap]);

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
  
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <Input
          placeholder="Buscar por labor, lote, campaña..."
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="w-full sm:max-w-sm h-9"
        />
        <div className="flex items-center gap-2">
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        <Filter className="mr-2 h-4 w-4" />
                        Filtros
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                    <div className="grid gap-4">
                        <div className="space-y-2"><h4 className="font-medium leading-none">Filtros Avanzados</h4></div>
                        <div className="grid gap-2">
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label>Campaña</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, campaign: v === 'all' ? '' : v}))} value={popoverFilters.campaign}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label>Lote</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, lote: v === 'all' ? '' : v}))} value={popoverFilters.lote}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                            </div>
                             <div className="grid grid-cols-3 items-center gap-4">
                                <Label>Labor</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, labor: v === 'all' ? '' : v}))} value={popoverFilters.labor}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div className="grid grid-cols-1 items-center gap-2">
                                <Label>Fecha</Label>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button id="date" variant={'outline'} className={cn('w-full justify-start text-left font-normal h-8', !popoverFilters.dateRange.from && 'text-muted-foreground' )}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {popoverFilters.dateRange?.from ? (popoverFilters.dateRange.to ? (<>{format(popoverFilters.dateRange.from, 'LLL dd, y')} - {format(popoverFilters.dateRange.to, 'LLL dd, y')}</>) : (format(popoverFilters.dateRange.from, 'LLL dd, y'))) : (<span>Seleccione un rango</span>)}
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
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={table.getRowModel().rows.length === 0} className="h-9">
                <FileDown className="mr-2 h-4 w-4" />
                Excel
            </Button>
        </div>
      </div>
     
      <div className="w-full overflow-x-auto rounded-lg border">
        <Table>
            <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap px-3 py-2">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                ))}
                </TableRow>
            ))}
            </TableHeader>
            <TableBody>
            {loading ? (
                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
            ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>{row.getVisibleCells().map((cell) => (<TableCell key={cell.id} className="whitespace-nowrap px-3 py-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>
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

    