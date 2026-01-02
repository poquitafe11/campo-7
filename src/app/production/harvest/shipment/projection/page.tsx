"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { collection, onSnapshot, doc, deleteDoc, addDoc, setDoc, query, orderBy, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Pencil, Plus, CalendarIcon } from 'lucide-react';
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
import { useMasterData } from '@/contexts/MasterDataContext';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';


const projectionSchema = z.object({
  fecha: z.date({ required_error: 'La fecha es requerida.' }),
  lote: z.string().min(1, 'El lote es requerido.'),
  cuartel: z.string().min(1, 'El cuartel es requerido.'),
  jabas: z.coerce.number().int().positive('Debe ser un número positivo.'),
  obs: z.string().optional(),
});

type ProjectionFormValues = z.infer<typeof projectionSchema>;
type ProjectionRecord = ProjectionFormValues & { 
  id: string;
  createdBy?: string;
};

export default function ShipmentProjectionPage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const { lotes, loading: masterLoading } = useMasterData();
  const { user } = useAuth();
  const [data, setData] = useState<ProjectionRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProjectionRecord | null>(null);

  const form = useForm<ProjectionFormValues>({
    resolver: zodResolver(projectionSchema),
  });

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


  useEffect(() => {
    setActions({ title: "Proyección de Embarques" });
    const q = query(collection(db, "proyeccion-embarque"), orderBy("fecha", "desc"));
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const recordsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha: doc.data().fecha.toDate(),
      }) as ProjectionRecord);
      setData(recordsData);

      // Fetch users as well
      const usersSnapshot = await getDocs(collection(db, "usuarios"));
      const usersData = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as User);
      setUsers(usersData);

      setLoading(false);
    }, (error) => {
      console.error("Error fetching projection records:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las proyecciones.' });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setActions, toast]);

  const handleEdit = (record: ProjectionRecord) => {
    setEditingRecord(record);
    form.reset(record);
    setIsFormOpen(true);
  };
  
  const handleCreate = () => {
    setEditingRecord(null);
    form.reset({
        fecha: new Date(),
        lote: '',
        cuartel: '',
        jabas: 0,
        obs: '',
    });
    setIsFormOpen(true);
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "proyeccion-embarque", id));
      toast({ title: 'Éxito', description: 'Proyección eliminada.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la proyección.' });
    }
  };
  
  const onSubmit = async (values: ProjectionFormValues) => {
    if (!user?.email) {
       toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario.' });
       return;
    }

    try {
      if (editingRecord) {
        const docRef = doc(db, 'proyeccion-embarque', editingRecord.id);
        await setDoc(docRef, { ...values, fecha: Timestamp.fromDate(values.fecha) }, { merge: true });
        toast({ title: 'Éxito', description: 'Proyección actualizada.' });
      } else {
        const docData = { ...values, fecha: Timestamp.fromDate(values.fecha), createdBy: user.email };
        await addDoc(collection(db, 'proyeccion-embarque'), docData);
        toast({ title: 'Éxito', description: 'Proyección guardada.' });
      }
      setIsFormOpen(false);
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la proyección.' });
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Base de Datos de Proyecciones</CardTitle>
          <CardDescription>
            Consulta y gestiona las proyecciones de embarques.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Cuartel</TableHead>
                    <TableHead>N° Jabas</TableHead>
                    <TableHead>Obs.</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                ) : data.length > 0 ? (
                  data.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(record.fecha, 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{record.lote}</TableCell>
                      <TableCell>{record.cuartel}</TableCell>
                      <TableCell>{record.jabas}</TableCell>
                      <TableCell>{record.obs}</TableCell>
                      <TableCell>{userMap.get(record.createdBy || '')?.nombre || record.createdBy}</TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}><Pencil className="h-4 w-4"/></Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción no se puede deshacer y eliminará permanentemente la proyección.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(record.id)}>Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center">No hay proyecciones guardadas.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
       <Button onClick={handleCreate} className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg">
        <Plus className="h-8 w-8" />
        <span className="sr-only">Agregar Proyección</span>
      </Button>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>{editingRecord ? "Editar Proyección" : "Nueva Proyección"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
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
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="lote" render={({ field }) => ( <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar"} /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="cuartel" render={({ field }) => ( <FormItem><FormLabel>Cuartel</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedLote}><FormControl><SelectTrigger><SelectValue placeholder={!selectedLote ? "Seleccione un lote" : "Seleccionar"} /></SelectTrigger></FormControl><SelectContent>{cuartelesOptions.map(c => <SelectItem key={c.id} value={c.cuartel}>{c.cuartel}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                    </div>
                     <FormField control={form.control} name="jabas" render={({ field }) => ( <FormItem><FormLabel>N° Jabas</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="obs" render={({ field }) => ( <FormItem><FormLabel>Obs.</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )}/>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                        <Button type="submit">Guardar</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
