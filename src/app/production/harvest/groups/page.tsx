
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as xlsx from "xlsx";
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
import { PlusCircle, Trash2, Pencil, Loader2, Users, FileUp, FileDown, CheckCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { addAsistente } from '@/app/asistentes/actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { db } from '@/lib/firebase';
import { writeBatch, doc, collection, deleteDoc } from 'firebase/firestore';


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

const newAssistantSchema = z.object({
    dni: z.string().optional(),
    nombre: z.string().min(1, "El nombre es requerido."),
    cargo: z.string().min(1, "El cargo es requerido."),
});

function normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/ó/g, 'o').replace(/ /g, '');
}

async function processAndUploadFile(file: File): Promise<{ count: number }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!e.target?.result) {
                    return reject(new Error('No se pudo leer el archivo.'));
                }
                const workbook = xlsx.read(e.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = xlsx.utils.sheet_to_json(worksheet, {raw: false});

                if (json.length === 0) {
                    return reject(new Error("El archivo está vacío o no tiene el formato correcto."));
                }

                const header = Object.keys(json[0]);
                const dniKey = header.find(key => normalizeKey(key).includes('dni'));
                const nombreKey = header.find(key => normalizeKey(key).includes('nombre'));
                const cargoKey = header.find(key => normalizeKey(key).includes('cargo'));

                if (!dniKey || !nombreKey || !cargoKey) {
                  return reject(new Error("El archivo debe contener columnas para 'DNI', 'Nombre' y 'Cargo'."));
                }

                const normalizedData = json.map(row => {
                  const dni = String(row[dniKey] || '').trim();
                  const nombre = String(row[nombreKey] || '').trim();
                  const cargo = String(row[cargoKey] || '').trim();
                  return { dni, nombre, cargo };
                }).filter(item => item.dni && item.nombre && item.cargo);


                if (normalizedData.length === 0) {
                    return reject(new Error("No se encontraron datos válidos con DNI, Nombre y Cargo en el archivo."));
                }

                const batch = writeBatch(db);
                normalizedData.forEach((asistente) => {
                    const docRef = doc(db, 'asistentes', asistente.dni);
                    batch.set(docRef, { nombre: asistente.nombre, cargo: asistente.cargo }, { merge: true });
                });

                await batch.commit();
                resolve({ count: normalizedData.length });

            } catch (error: any) {
                console.error('Error processing or uploading file: ', error);
                reject(new Error(error.message || 'Hubo un error al procesar el archivo.'));
            }
        };
        reader.onerror = (error) => {
            reject(new Error('Error al leer el archivo.'));
        };
        reader.readAsBinaryString(file);
    });
}


export default function HarvestGroupsPage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const { asistentes, loading: masterLoading, refreshData } = useMasterData();

  const [groups, setGroups] = useState<Group[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewAssistantFormOpen, setNewAssistantFormOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);


  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
  });

  const assistantForm = useForm<z.infer<typeof newAssistantSchema>>({
    resolver: zodResolver(newAssistantSchema),
    defaultValues: { nombre: '', dni: '', cargo: '' }
  });

  useEffect(() => {
    setActions({ title: "Gestión de Grupos de Cosecha" });
    return () => setActions({});
  }, [setActions]);

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    groupForm.reset(group);
    setIsFormOpen(true);
  };
  
  const handleCreate = () => {
    setEditingGroup(null);
    groupForm.reset({
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

  const handleDeleteAssistant = async (id: string) => {
    try {
        await deleteDoc(doc(db, "asistentes", id));
        toast({ title: "Éxito", description: "Asistente eliminado." });
        refreshData();
    } catch(e) {
        toast({ title: "Error", description: "No se pudo eliminar el asistente."});
    }
  };
  
  const onGroupSubmit = async (values: GroupFormValues) => {
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

  const onAssistantSubmit = async (values: z.infer<typeof newAssistantSchema>) => {
      setIsSubmitting(true);
      const result = await addAsistente(values);
      if (result.success) {
          toast({ title: "Éxito", description: "Asistente agregado."});
          setNewAssistantFormOpen(false);
          assistantForm.reset();
          refreshData();
      } else {
          toast({ title: "Error", description: result.message, variant: "destructive"});
      }
      setIsSubmitting(false);
  };
  
  const tableData = useMemo(() => {
    return groups.map(g => ({
        ...g,
        asistenteName: asistentes.find(a => a.id === g.asistenteId)?.assistantName,
        tickeraName: asistentes.find(a => a.id === g.tickeraId)?.assistantName,
        embarcadorName: asistentes.find(a => a.id === g.embarcadorId)?.assistantName,
    }))
  }, [groups, asistentes]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const { count } = await processAndUploadFile(selectedFile);
      toast({ title: "Éxito", description: `${count} registros cargados/actualizados.` });
      refreshData();
    } catch (error: any) {
      toast({ title: "Error al Cargar", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
    }
  };


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <TooltipProvider>
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
        
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Maestro de Asistentes</CardTitle>
                    <div className="flex items-center gap-2">
                         <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileSelect}
                            />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="icon"><FileUp className="h-4 w-4" /></Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Cargar desde Excel</p></TooltipContent>
                        </Tooltip>
                        <Button onClick={() => setNewAssistantFormOpen(true)}><PlusCircle className="h-4 w-4 mr-2"/>Agregar Asistente</Button>
                    </div>
                </div>
                {selectedFile && (
                    <div className="flex items-center gap-4 p-3 mt-4 border rounded-lg bg-muted/50">
                        <span className="flex-grow text-sm font-medium text-muted-foreground truncate">{selectedFile.name}</span>
                        <Button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} variant="ghost" size="icon">
                        <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={handleConfirmUpload} disabled={isUploading}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        {isUploading ? 'Subiendo...' : 'Confirmar'}
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>DNI</TableHead>
                                <TableHead>Cargo</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {masterLoading ? (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></TableCell></TableRow>
                        ) : asistentes.length > 0 ? (
                            asistentes.map(asistente => (
                                <TableRow key={asistente.id}>
                                    <TableCell>{asistente.assistantName}</TableCell>
                                    <TableCell>{asistente.id}</TableCell>
                                    <TableCell>{asistente.cargo}</TableCell>
                                    <TableCell className="text-right">
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                    <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente al asistente.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteAssistant(asistente.id)}>Eliminar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">No hay asistentes.</TableCell></TableRow>
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
                <Form {...groupForm}>
                    <form onSubmit={groupForm.handleSubmit(onGroupSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={groupForm.control}
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
                            control={groupForm.control}
                            name="tickeraId"
                            render={({ field }) => (
                                <FormItem><FormLabel>Tickera</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                        <SelectContent>{asistentes.map(a => <SelectItem key={a.id} value={a.id}>{a.assistantName}</SelectItem>)}</SelectContent>
                                    </Select>
                                <FormMessage /></FormItem>
                            )}
                        />
                        <FormField
                            control={groupForm.control}
                            name="embarcadorId"
                            render={({ field }) => (
                                <FormItem><FormLabel>Embarcador</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                                        <SelectContent>{asistentes.map(a => <SelectItem key={a.id} value={a.id}>{a.assistantName}</SelectItem>)}</SelectContent>
                                    </Select>
                                <FormMessage /></FormItem>
                            )}
                        />
                        <FormField
                            control={groupForm.control}
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

        <Dialog open={isNewAssistantFormOpen} onOpenChange={setNewAssistantFormOpen}>
             <DialogContent>
                <DialogHeader><DialogTitle>Agregar Nuevo Asistente</DialogTitle></DialogHeader>
                <Form {...assistantForm}>
                    <form onSubmit={assistantForm.handleSubmit(onAssistantSubmit)} className="space-y-4 pt-4">
                        <FormField control={assistantForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={assistantForm.control} name="dni" render={({ field }) => (<FormItem><FormLabel>DNI (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                        <FormField control={assistantForm.control} name="cargo" render={({ field }) => (<FormItem><FormLabel>Cargo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                         <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Agregar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
             </DialogContent>
        </Dialog>
      </TooltipProvider>
    </div>
  );
}
