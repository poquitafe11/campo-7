
"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteAttendanceRecord } from './actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useRouter } from 'next/navigation';
import type { AttendanceRecord } from '@/lib/types';

type AttendanceRecordWithId = AttendanceRecord & { id: string };

export default function AttendanceDatabasePage() {
  const [data, setData] = useState<AttendanceRecordWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { setActions } = useHeaderActions();
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "asistencia"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AttendanceRecordWithId));
      setData(recordsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching attendance records: ", error);
      toast({
        title: "Error de Conexión",
        description: "No se pudieron cargar los registros de asistencia.",
        variant: "destructive"
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);
  
  useEffect(() => {
    setActions({
      left: (
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ),
      title: "Historial de Asistencia",
    });
    return () => setActions({});
  }, [setActions, router]);


  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteAttendanceRecord(id);
      if (result.success) {
        toast({ title: "Éxito", description: "Registro de asistencia eliminado." });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  const columns = useMemo<ColumnDef<AttendanceRecordWithId>[]>(() => [
    { 
      accessorKey: 'date', 
      header: 'Fecha',
      cell: ({ row }) => {
        const date = row.original.date ? parseISO(row.original.date) : null;
        return date ? format(date, 'dd/MM/yyyy') : 'N/A';
      }
    },
    { accessorKey: 'lote', header: 'Lote' },
    { accessorKey: 'labor', header: 'Labor' },
    { 
        accessorKey: 'assistants', 
        header: 'Asistente/s',
        cell: ({ row }) => (
            <ul className="list-disc list-inside">
                {row.original.assistants.map(a => <li key={a.id}>{a.assistantName}</li>)}
            </ul>
        )
    },
    { 
        accessorKey: 'totals.personnelCount', 
        header: 'Personal Total',
        cell: ({ row }) => row.original.totals.personnelCount
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
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
      ),
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No se encontraron registros de asistencia.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
