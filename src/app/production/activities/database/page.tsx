
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ActivityRecordData, User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteActivity } from './actions';
import EditActivityDialog from '@/components/EditActivityDialog'; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type ActivityRecordWithId = ActivityRecordData & { id: string };

export default function ActivityDatabasePage() {
  const [data, setData] = useState<ActivityRecordWithId[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecordWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [globalFilter, setGlobalFilter] = useState('');

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(user => {
        map.set(user.email, user.nombre);
    });
    // Add admin user as a special case
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

      // Fetch users
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
    data,
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
      <Input
        placeholder="Buscar por labor, lote, campaña..."
        value={globalFilter}
        onChange={(event) => setGlobalFilter(event.target.value)}
        className="w-full h-10"
      />
     
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
