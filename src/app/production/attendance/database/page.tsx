
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { type AttendanceRecord } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export default function AttendanceDatabasePage() {
  const { toast } = useToast();
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'asistencia'), (snapshot) => {
      const records = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AttendanceRecord[];
      setData(records);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching attendance data:", error);
        toast({
            variant: "destructive",
            title: "Error de Carga",
            description: "No se pudieron cargar los registros de asistencia."
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);
  
  const uniqueLotes = useMemo(() => {
    const lotes = new Set(data.map(item => item.lote));
    return Array.from(lotes).sort();
  }, [data]);

  const columns = useMemo<ColumnDef<AttendanceRecord>[]>(
    () => [
      {
        accessorKey: 'date',
        header: 'Fecha',
        cell: ({ row }) => {
            const dateValue = row.getValue('date');
            if (!dateValue || typeof dateValue !== 'string') return "N/A";
            const date = parseISO(dateValue);
            return format(date, 'dd/MM/yyyy');
        }
      },
      { accessorKey: 'lote', header: 'Lote' },
      { accessorKey: 'labor', header: 'Labor' },
      { 
        accessorKey: 'assistants',
        header: 'Asistentes',
        cell: ({ row }) => {
            const assistants: any[] = row.getValue('assistants');
            if (!assistants || !Array.isArray(assistants)) return "";
            return assistants.map(a => a.assistantName).join(', ');
        }
      },
      { 
        accessorKey: 'totals.personnelCount', 
        header: 'Nº Personas'
      },
       { 
        accessorKey: 'totals.absentCount', 
        header: 'Nº Faltos'
      },
      { accessorKey: 'registeredBy', header: 'Registrado Por' },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      globalFilter,
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/production/attendance">
              <ArrowLeft />
              <span className="sr-only">Volver a Asistencia</span>
            </Link>
          </Button>
          <h1 className="text-lg font-semibold font-headline sm:text-xl">
            Base de Datos de Asistencia
          </h1>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">
        <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar en todo..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {table.getColumn('date')?.getFilterValue() ? format(parseISO(table.getColumn('date')?.getFilterValue() as string), 'PPP', {locale: es}) : 'Filtrar por Fecha'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={table.getColumn('date')?.getFilterValue() ? parseISO(table.getColumn('date')?.getFilterValue() as string) : undefined}
                                onSelect={(date) => table.getColumn('date')?.setFilterValue(date ? format(date, 'yyyy-MM-dd') : undefined)}
                                initialFocus
                                locale={es}
                            />
                        </PopoverContent>
                    </Popover>
                    <Select
                        value={table.getColumn('lote')?.getFilterValue() as string ?? 'all'}
                        onValueChange={value => {
                            const filterValue = value === 'all' ? undefined : value;
                            table.getColumn('lote')?.setFilterValue(filterValue);
                        }}
                    >
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filtrar por Lote" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los lotes</SelectItem>
                            {uniqueLotes.map(lote => (
                                <SelectItem key={lote} value={lote}>{lote}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
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
                        <TableRow key={row.id}>{row.getVisibleCells().map((cell) => ( <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell> ))}</TableRow>
                    ))
                    ) : (
                    <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay registros que coincidan con los filtros.</TableCell></TableRow>
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
      </main>
    </div>
  );
}
