
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ActivityRecordData } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeaderWithNav } from '@/components/PageHeaderWithNav';
import { Pencil, Trash2, Loader2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ActivityRecordWithId = ActivityRecordData & { id: string };

export default function ActivityDatabasePage() {
  const [data, setData] = useState<ActivityRecordWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "actividades"), orderBy("registerDate", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => {
        const docData = doc.data();
        const registerDate = docData.registerDate?.toDate ? docData.registerDate.toDate() : new Date();
        return { ...docData, id: doc.id, registerDate } as ActivityRecordWithId;
      });
      setData(recordsData);
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

    return () => unsubscribe();
  }, [toast]);

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
    { accessorKey: 'personnelCount', header: '# Pers.' },
    { accessorKey: 'workdayCount', header: '# Jorn.' },
    { 
      accessorKey: 'cost', 
      header: 'Costo (S/)',
      cell: ({ row }) => `S/ ${row.original.cost.toFixed(2)}`
    },
    { accessorKey: 'shift', header: 'Turno' },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="icon" className="h-8 w-8">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: { columnFilters }
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeaderWithNav title="Base de Registro de Actividades" />
      <div className="space-y-4">
        <div className="flex items-center justify-start">
          <Input
            placeholder="Buscar por labor..."
            value={(table.getColumn('labor')?.getFilterValue() as string) ?? ''}
            onChange={(event) => table.getColumn('labor')?.setFilterValue(event.target.value)}
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
    </div>
  );
}
