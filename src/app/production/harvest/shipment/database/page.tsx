
"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { collection, onSnapshot, doc, deleteDoc, query, orderBy, updateDoc, serverTimestamp, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as xlsx from 'xlsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';


import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Pencil, FileDown, ChevronLeft, ChevronRight, CalendarIcon, QrCode } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMasterData } from '@/context/MasterDataContext';
import { cn } from '@/lib/utils';
import type { LoteData, User } from '@/lib/types';


const shipmentEditSchema = z.object({
  fecha: z.date({ required_error: 'La fecha es requerida.' }),
  responsable: z.string().min(1, 'El responsable es requerido.'),
  guia: z.string().min(1, 'El N° de guía es requerido.'),
  lote: z.string().min(1, 'El lote es requerido.'),
  cuartel: z.string().min(1, 'El cuartel es requerido.'),
  turno: z.string().min(1, 'El turno es requerido.'),
  grupo: z.coerce.number().int().positive('Debe ser un número positivo.'),
  viaje: z.coerce.number().int().positive('Debe ser un número positivo.'),
  jabas: z.coerce.number().int().positive('Debe ser un número positivo.'),
  horaEmbarque: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato HH:MM requerido."),
  tractor: z.string().min(1, 'El N° de tractor es requerido.'),
  operador: z.string().min(1, 'El nombre del operador es requerido.'),
  obs: z.string().optional(),
});
type ShipmentEditValues = z.infer<typeof shipmentEditSchema>;

type ShipmentRecord = {
  id: string;
  fecha: any; // Can be a Timestamp
  responsable: string;
  guia: string;
  lote: string;
  cuartel: string;
  turno: string;
  grupo: number;
  viaje: number;
  jabas: number;
  horaEmbarque: string;
  tractor: string;
  operador: string;
  obs?: string;
  createdBy?: string;
  createdAt?: any;
};

type Group = {
  id: string;
  numeroGrupo: number;
  asistenteId: string;
  tickeraId: string;
  embarcadorId: string;
};

export default function ShipmentDatabasePage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const { asistentes, lotes, loading: masterLoading } = useMasterData();
  const [data, setData] = useState<ShipmentRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ShipmentRecord | null>(null);

  const form = useForm<ShipmentEditValues>({
    resolver: zodResolver(shipmentEditSchema),
  });

  useEffect(() => {
    setActions({ title: "Base de Datos de Embarques" });
    return () => setActions({});
  }, [setActions]);

  useEffect(() => {
    const q = query(collection(db, "registros-embarque"), orderBy("fecha", "desc"));
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const recordsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let fecha;
        if (data.fecha && data.fecha.toDate) {
          fecha = data.fecha.toDate();
        } else if (typeof data.fecha === 'string') {
          fecha = parseISO(data.fecha);
        } else {
          fecha = new Date();
        }
        return {
          id: doc.id,
          ...data,
          fecha,
        } as ShipmentRecord
      });
      setData(recordsData);

      // Fetch users and groups as well
      const [usersSnapshot, groupsSnapshot] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "grupos-cosecha"))
      ]);
      const usersData = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as User);
      setUsers(usersData);
      
      const groupsData = groupsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Group);
      setGroups(groupsData);


      setLoading(false);
    }, (error) => {
      console.error("Error fetching shipment records:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los registros.' });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);
  
  const handleEdit = (record: ShipmentRecord) => {
    setEditingRecord(record);
    form.reset({
      ...record,
      fecha: record.fecha instanceof Date ? record.fecha : record.fecha.toDate(),
    });
    setIsEditDialogOpen(true);
  };
  
  const handleSaveEdit = async (values: ShipmentEditValues) => {
    if (!editingRecord) return;
    try {
      const docRef = doc(db, 'registros-embarque', editingRecord.id);
      await updateDoc(docRef, { ...values, fecha: Timestamp.fromDate(values.fecha) });
      toast({ title: 'Éxito', description: 'Registro actualizado.' });
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating record:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el registro.' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
        await deleteDoc(doc(db, "registros-embarque", id));
        toast({ title: 'Éxito', description: 'Registro eliminado correctamente.' });
    } catch (error) {
        console.error("Error deleting record:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el registro.' });
    }
  };
  
  const { watch } = form;
  const selectedLote = watch('lote');
  
  const uniqueLotes = useMemo(() => {
    return [...new Map(lotes.map(l => [l.lote, l])).values()];
  }, [lotes]);

  const cuartelesOptions = useMemo(() => {
    if (!selectedLote) return [];
    return lotes.filter(l => l.lote === selectedLote);
  }, [selectedLote, lotes]);

  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(user => {
        if(user.email) map.set(user.email, user);
    });
    return map;
  }, [users]);


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
    { accessorKey: "turno", header: "Turno" },
    { accessorKey: "grupo", header: "Grupo" },
    {
      id: 'asistenteGrupo',
      header: 'Asistente Grupo',
      cell: ({ row }) => {
        const groupData = groups.find(g => g.numeroGrupo === row.original.grupo);
        return groupData ? (asistentes.find(a => a.id === groupData.asistenteId)?.assistantName || 'N/A') : 'N/A';
      },
    },
    {
      id: 'tickeraGrupo',
      header: 'Tickera',
      cell: ({ row }) => {
        const groupData = groups.find(g => g.numeroGrupo === row.original.grupo);
        return groupData ? (asistentes.find(a => a.id === groupData.tickeraId)?.assistantName || 'N/A') : 'N/A';
      },
    },
    {
      id: 'embarcadorGrupo',
      header: 'Embarcador',
      cell: ({ row }) => {
        const groupData = groups.find(g => g.numeroGrupo === row.original.grupo);
        return groupData ? (asistentes.find(a => a.id === groupData.embarcadorId)?.assistantName || 'N/A') : 'N/A';
      },
    },
    { accessorKey: "viaje", header: "Viaje" },
    { accessorKey: "jabas", header: "Jabas" },
    { accessorKey: "horaEmbarque", header: "Hora" },
    { accessorKey: "tractor", header: "Tractor" },
    { accessorKey: "operador", header: "Operador" },
    { accessorKey: "obs", header: "Obs." },
    {
      accessorKey: "createdBy", 
      header: "Usuario",
      cell: ({ row }) => userMap.get(row.original.createdBy || '')?.nombre || row.original.createdBy
    },
    {
      id: 'fechaCreacion',
      header: 'Fecha Creación',
      cell: ({ row }) => row.original.createdAt?.toDate ? format(row.original.createdAt.toDate(), 'dd/MM/yy HH:mm') : 'N/A'
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(row.original)}>
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
  ], [asistentes, userMap, groups]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  
  const handleDownload = () => {
    const dataToExport = data.map(row => {
      const groupData = groups.find(g => g.numeroGrupo === row.grupo);
      const asistenteName = groupData ? asistentes.find(a => a.id === groupData.asistenteId)?.assistantName : 'N/A';
      const tickeraName = groupData ? asistentes.find(a => a.id === groupData.tickeraId)?.assistantName : 'N/A';
      const embarcadorName = groupData ? asistentes.find(a => a.id === groupData.embarcadorId)?.assistantName : 'N/A';

      return {
        Fecha: format(row.fecha, 'dd/MM/yyyy'),
        Responsable: asistentes.find(a => a.id === row.responsable)?.assistantName || row.responsable,
        Guia: row.guia,
        Lote: row.lote,
        Cuartel: row.cuartel,
        Turno: row.turno,
        Grupo: row.grupo,
        'Nombre Asistente (Grupo)': asistenteName,
        'Nombre Tickera': tickeraName,
        'Nombre Embarcador': embarcadorName,
        Viaje: row.viaje,
        Jabas: row.jabas,
        Hora: row.horaEmbarque,
        Tractor: row.tractor,
        Operador: row.operador,
        Observaciones: row.obs,
        Usuario: userMap.get(row.createdBy || '')?.nombre || row.createdBy,
        'Fecha Creación': row.createdAt?.toDate ? format(row.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A',
      }
    });
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Registro de Embarque</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveEdit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
              <FormField control={form.control} name="fecha" render={({ field }) => (
                <FormItem><FormLabel>Fecha</FormLabel>
                  <Popover><PopoverTrigger asChild><FormControl>
                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                  <FormMessage />
                </FormItem>
              )}/>
               <FormField control={form.control} name="responsable" render={({ field }) => (
                <FormItem><FormLabel>Responsable</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar"} /></SelectTrigger></FormControl>
                        <SelectContent>{asistentes.map(a => <SelectItem key={a.id} value={a.id}>{a.assistantName}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}/>
              <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="guia" render={({ field }) => ( <FormItem><FormLabel>Guía</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                  <FormField control={form.control} name="lote" render={({ field }) => ( <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar"} /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="cuartel" render={({ field }) => ( <FormItem><FormLabel>Cuartel</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedLote}><FormControl><SelectTrigger><SelectValue placeholder={!selectedLote ? "Seleccione un lote" : "Seleccionar"} /></SelectTrigger></FormControl><SelectContent>{cuartelesOptions.map(c => <SelectItem key={c.id} value={c.cuartel}>{c.cuartel}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="turno" render={({ field }) => (
                    <FormItem><FormLabel>Turno</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Mañana">Mañana</SelectItem>
                                <SelectItem value="Tarde">Tarde</SelectItem>
                                <SelectItem value="Noche">Noche</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="grupo" render={({ field }) => ( <FormItem><FormLabel>N° Grupo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                  <FormField control={form.control} name="viaje" render={({ field }) => ( <FormItem><FormLabel>N° Viaje</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="jabas" render={({ field }) => ( <FormItem><FormLabel>N° Jabas</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                  <FormField control={form.control} name="horaEmbarque" render={({ field }) => ( <FormItem><FormLabel>Hora Embarque</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="tractor" render={({ field }) => ( <FormItem><FormLabel>N° Tractor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                  <FormField control={form.control} name="operador" render={({ field }) => ( <FormItem><FormLabel>Operador</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
              </div>
              <FormField control={form.control} name="obs" render={({ field }) => ( <FormItem><FormLabel>Obs.</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )}/>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                <Button type="submit">Guardar Cambios</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
