"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useMasterData } from '@/context/MasterDataContext';
import { PlusCircle, Trash2, Pencil, Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const groupSchema = z.object({
  id: z.string().optional(),
  asistenteId: z.string().min(1, "Debe seleccionar un asistente."),
  tickeraId: z.string().min(1, "Debe seleccionar una tickera."),
  embarcadorId: z.string().min(1, "Debe seleccionar un embarcador."),
  numeroGrupo: z.coerce.number().int().positive("El número de grupo es requerido."),
});

type GroupFormValues = z.infer<typeof groupSchema>;
type Group = GroupFormValues & {
    asistenteName?: string;
    tickeraName?: string;
    embarcadorName?: string;
};

export default function HarvestGroupsPage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const { asistentes, trabajadores, loading: masterLoading } = useMasterData();

  const [groups, setGroups] = useState<Group[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
  });

  useEffect(() => {
    setActions({ title: "Gestión de Grupos de Cosecha" });
    return () => setActions({});
  }, [setActions]);

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    form.reset(group);
    setIsFormOpen(true);
  };
  
  const handleCreate = () => {
    setEditingGroup(null);
    form.reset({
        numeroGrupo: (groups.length > 0 ? Math.max(...groups.map(g => g.numeroGrupo)) + 1 : 1),
        asistenteId: '',
        tickeraId: '',
        embarcadorId: '',
    });
    setIsFormOpen(true);
  }

  const handleDelete = (id: string) => {
    // TODO: Add Firestore deletion logic
    console.log("Deleting group", id);
    toast({ title: "Simulación", description: `Grupo con ID ${id} eliminado.` });
  };
  
  const onSubmit = async (values: GroupFormValues) => {
    setIsSubmitting(true);
    // TODO: Add Firestore saving logic (create or update)
    console.log(values);
    
    // Simulating API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
        title: editingGroup ? "Grupo Actualizado" : "Grupo Creado",
        description: `El grupo N° ${values.numeroGrupo} ha sido guardado.`,
    });

    setIsSubmitting(false);
    setIsFormOpen(false);
  };
  
  const tableData = useMemo(() => {
    return groups.map(g => ({
        ...g,
        asistenteName: asistentes.find(a => a.id === g.asistenteId)?.assistantName,
        tickeraName: trabajadores.find(t => t.dni === g.tickeraId)?.name,
        embarcadorName: trabajadores.find(t => t.dni === g.embarcadorId)?.name,
    }))
  }, [groups, asistentes, trabajadores]);


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2"><Users /> Grupos de Cosecha</CardTitle>
              <CardDescription>Crea y administra los grupos para la cosecha.</CardDescription>
            </div>
            <Button onClick={handleCreate}><PlusCircle className="mr-2 h-4 w-4"/>Crear Grupo</Button>
          </div>
        </CardHeader>
        <CardContent>
           <div className="rounded-md border">
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Asistente</TableHead>
                        <TableHead>Tickera</TableHead>
                        <TableHead>Embarcador</TableHead>
                        <TableHead>N° Grupo</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {masterLoading ? (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></TableCell></TableRow>
                    ) : tableData.length > 0 ? (
                        tableData.map(group => (
                            <TableRow key={group.id}>
                                <TableCell>{group.asistenteName || group.asistenteId}</TableCell>
                                <TableCell>{group.tickeraName || group.tickeraId}</TableCell>
                                <TableCell>{group.embarcadorName || group.embarcadorId}</TableCell>
                                <TableCell>{group.numeroGrupo}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(group)}><Pencil className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(group.id!)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                         <TableRow><TableCell colSpan={5} className="h-24 text-center">No hay grupos creados.</TableCell></TableRow>
                    )}
                </TableBody>
              </Table>
           </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingGroup ? "Editar Grupo" : "Crear Nuevo Grupo"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                     <FormField
                        control={form.control}
                        name="asistenteId"
                        render={({ field }) => (
                            <FormItem><FormLabel>Asistente</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                    <SelectContent>{asistentes.map(a => <SelectItem key={a.id} value={a.id}>{a.assistantName}</SelectItem>)}</SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="tickeraId"
                        render={({ field }) => (
                            <FormItem><FormLabel>Tickera</FormLabel>
                                 <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                    <SelectContent>{trabajadores.map(t => <SelectItem key={t.dni} value={t.dni}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="embarcadorId"
                        render={({ field }) => (
                            <FormItem><FormLabel>Embarcador</FormLabel>
                                 <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                    <SelectContent>{trabajadores.map(t => <SelectItem key={t.dni} value={t.dni}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="numeroGrupo"
                        render={({ field }) => (
                            <FormItem><FormLabel>N° de Grupo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )}
                    />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Guardar
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
