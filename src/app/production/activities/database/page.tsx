
"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import Link from 'next/link';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as xlsx from "xlsx";
import { ActivityRecordData, User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Loader2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, FileDown, Filter, RefreshCcw, LayoutGrid, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteActivity } from './actions';
import EditActivityDialog from '@/components/EditActivityDialog'; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

type ActivityRecordWithId = ActivityRecordData & { id: string };

const getInitialFilters = () => ({
  campaign: '',
  lote: '',
  labor: '',
  pasada: '',
  global: ''
});

export default function ActivityDatabasePage() {
  const router = useRouter();
  const [data, setData] = useState<ActivityRecordWithId[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecordWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [activeFilters, setActiveFilters] = useState(getInitialFilters());
  const [popoverFilters, setPopoverFilters] = useState(getInitialFilters());
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const filterOptions = useMemo(() => {
    const campaigns = [...new Set(data.map(a => a.campaign))].sort();
    const lotes = [...new Set(data.map(a => a.lote))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    const labors = [...new Set(data.map(a => a.labor).filter(Boolean) as string[])].sort();
    const pasadas = [...new Set(data.map(a => String(a.pass)))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    return { campaigns, lotes, labors, pasadas };
  }, [data]);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(user => {
        map.set(user.email, user.nombre);
    });
    // Add admin user as a special case
    map.set('marcoromau@gmail.com', 'Marco Romau');
    return map;
  }, [users]);
  
  const fetchData = useCallback((showToast = false) => {
    setLoading(true);
    const q = query(collection(db, "actividades"), orderBy("registerDate", "desc"));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const recordsData = snapshot.docs.map(doc => {
        const docData = doc.data();
        const registerDate = docData.registerDate?.toDate ? docData.registerDate.toDate() : new Date();
        return { ...docData, id: doc.id, registerDate } as ActivityRecordWithId;
      });
      setData(recordsData);

      // Fetch users
       try {
        const usersSnapshot = await getDocs(collection(db, "usuarios"));
        const usersData = usersSnapshot.docs.map(doc => doc.data() as User);
        setUsers(usersData);
      } catch (userError) {
         console.error("Error fetching users: ", userError);
         toast({
          title: "Error",
          description: "No se pudieron cargar los nombres de los usuarios.",
          variant: "destructive"
        });
      }
      setLoading(false);
      if (showToast) {
        toast({ title: 'Éxito', description: 'Datos actualizados correctamente.' });
      }

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
      cell: ({ row }) => <div className="min-w-[250px]">{row.original.labor}</div>
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
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="h-8 w-8">
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

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const campaignMatch = activeFilters.campaign ? item.campaign === activeFilters.campaign : true;
      const loteMatch = activeFilters.lote ? item.lote === activeFilters.lote : true;
      const laborMatch = activeFilters.labor ? item.labor === activeFilters.labor : true;
      const pasadaMatch = activeFilters.pasada ? String(item.pass) === activeFilters.pasada : true;
      
      const globalFilter = activeFilters.global.toLowerCase();
      const globalMatch = activeFilters.global ? 
        (item.labor?.toLowerCase().includes(globalFilter) || 
         item.lote?.toLowerCase().includes(globalFilter) ||
         item.campaign?.toLowerCase().includes(globalFilter)) : true;
      
      return campaignMatch && loteMatch && laborMatch && pasadaMatch && globalMatch;
    });
  }, [data, activeFilters]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  
  const handlePopoverFilterChange = (filterName: keyof typeof popoverFilters, value: string) => {
    setPopoverFilters(prev => ({ ...prev, [filterName]: value === 'all' ? '' : value }));
  };

  const handleApplyFilters = () => {
    setActiveFilters(popoverFilters);
    setIsFilterOpen(false);
  };
  
  const handleDownload = () => {
    const dataToExport = table.getFilteredRowModel().rows.map(row => {
        const { id, createdBy, ...rest } = row.original;
        return {
            ...rest,
            registerDate: format(rest.registerDate, 'dd/MM/yyyy'),
            createdBy: userMap.get(createdBy) || createdBy,
        };
    });
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Actividades");
    xlsx.writeFile(workbook, "BaseDeDatos_Actividades.xlsx");
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
       <header className="flex items-center justify-between mb-6 pb-4 border-b">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-bold tracking-tight text-foreground ml-2">Base de Datos de Actividades</h1>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => fetchData(true)} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                </Button>
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="icon">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                        <div className="grid gap-4">
                            <div className="space-y-2"><h4 className="font-medium leading-none">Filtros</h4></div>
                            <div className="grid gap-2">
                                <Label>Campaña</Label>
                                <Select onValueChange={(v) => handlePopoverFilterChange('campaign', v)} value={popoverFilters.campaign}><SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                                <Label>Lote</Label>
                                <Select onValueChange={(v) => handlePopoverFilterChange('lote', v)} value={popoverFilters.lote}><SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                                <Label>Labor</Label>
                                <Select onValueChange={(v) => handlePopoverFilterChange('labor', v)} value={popoverFilters.labor}><SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                                <Label>Pasada</Label>
                                <Select onValueChange={(v) => handlePopoverFilterChange('pasada', v)} value={popoverFilters.pasada}><SelectTrigger className="h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.pasadas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <Button onClick={handleApplyFilters}>Aplicar</Button>
                        </div>
                    </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" onClick={handleDownload} disabled={table.getRowModel().rows.length === 0}>
                    <FileDown className="h-4 w-4" />
                </Button>
                 <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard">
                        <LayoutGrid className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
        </header>

      <div className="space-y-4">
        <div className="flex items-center justify-start">
          <Input
            placeholder="Buscar por labor, lote, campaña..."
            value={popoverFilters.global}
            onChange={(event) => {
              const newGlobalFilter = event.target.value;
              setPopoverFilters(prev => ({...prev, global: newGlobalFilter}));
              setActiveFilters(prev => ({...prev, global: newGlobalFilter}));
            }}
            className="max-w-sm h-9"
          />
        </div>
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
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
                    <TableRow key={row.id}>{row.getVisibleCells().map((cell) => (<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>
                    ))
                ) : (
                    <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No se encontraron registros.</TableCell></TableRow>
                )}
                </TableBody>
            </Table>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Select value={`${table.getState().pagination.pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}>
                  <SelectTrigger className="w-[70px] h-9"><SelectValue placeholder={table.getState().pagination.pageSize} /></SelectTrigger>
                  <SelectContent>{[10, 20, 50, 100].map((pageSize) => ( <SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem> ))}</SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Fila {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}-
                  {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "}
                  de {table.getFilteredRowModel().rows.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="h-9 w-9"><ChevronsLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-9 w-9"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm">Página {table.getPageCount() > 0 ? table.getState().pagination.pageIndex + 1 : 0} de {table.getPageCount()}</span>
                <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-9 w-9"><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="h-9 w-9"><ChevronsRight className="h-4 w-4" /></Button>
              </div>
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
                    // The onSnapshot listener will update the data automatically
                }}
            />
        )}
    </div>
  );
}

    