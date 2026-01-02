"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { collection, onSnapshot, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as xlsx from 'xlsx';

import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Pencil, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMasterData } from '@/context/MasterDataContext';

type ShipmentRecord = {
  id: string;
  fecha: any; // Can be a Timestamp
  responsable: string;
  guia: string;
  lote: string;
  cuartel: string;
  grupo: number;
  viaje: number;
  jabas: number;
  horaEmbarque: string;
  tractor: string;
  operador: string;
  obs?: string;
};

export default function ShipmentDatabasePage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const { asistentes } = useMasterData();
  const [data, setData] = useState<ShipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActions({ title: "Base de Datos de Embarques" });
    return () => setActions({});
  }, [setActions]);

  useEffect(() => {
    const q = query(collection(db, "registros-embarque"), orderBy("fecha", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const recordsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha.toDate(), // Convert Timestamp to Date
      } as ShipmentRecord));
      setData(recordsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching shipment records:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los registros.' });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);
  
  const handleDelete = async (id: string) => {
    try {
        await deleteDoc(doc(db, "registros-embarque", id));
        toast({ title: 'Éxito', description: 'Registro eliminado correctamente.' });
    } catch (error) {
        console.error("Error deleting record:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el registro.' });
    }
  };

  const columns = useMemo<ColumnDef<ShipmentRecord>[]>(() => [
    { accessorKey: "fecha", header: "Fecha", cell: ({ row }) => format(row.original.fecha, 'dd/MM/yyyy') },
    { 
      accessorKey: "responsable", 
      header: "Responsable", 
      cell: ({ row }) => asistentes.find(a => a.id === row.original.responsable)?.assistantName || row.original.responsable
    },
    { accessorKey: "guia", header: "Guía" },
    { accessorKey: "lote", header: "Lote" },
    { accessorKey: "cuartel", header: "Cuartel" },
    { accessorKey: "grupo", header: "Grupo" },
    { accessorKey: "viaje", header: "Viaje" },
    { accessorKey: "jabas", header: "Jabas" },
    { accessorKey: "horaEmbarque", header: "Hora" },
    { accessorKey: "tractor", header: "Tractor" },
    { accessorKey: "operador", header: "Operador" },
    { accessorKey: "obs", header: "Obs." },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" disabled>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer y eliminará permanentemente el registro.</AlertDialogDescription>
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
  ], [asistentes]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleDownload = () => {
    const dataToExport = data.map(row => ({
      Fecha: format(row.fecha, 'dd/MM/yyyy'),
      Responsable: asistentes.find(a => a.id === row.responsable)?.assistantName || row.responsable,
      Guia: row.guia,
      Lote: row.lote,
      Cuartel: row.cuartel,
      Grupo: row.grupo,
      Viaje: row.viaje,
      Jabas: row.jabas,
      Hora: row.horaEmbarque,
      Tractor: row.tractor,
      Operador: row.operador,
      Observaciones: row.obs,
    }));
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Embarques');
    xlsx.writeFile(workbook, 'Registros_Embarque.xlsx');
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Historial de Embarques</CardTitle>
              <CardDescription>
                Consulte todos los registros de embarques guardados.
              </CardDescription>
            </div>
            <Button onClick={handleDownload} disabled={data.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> Descargar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                    <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>{row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}</TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay registros para mostrar.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
             <span className="text-sm">
                Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              </span>
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
        </CardContent>
      </Card>
    </div>
  );
}
