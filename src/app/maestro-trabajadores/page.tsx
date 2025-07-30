
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { WorkerMasterItem } from '@/lib/types';
import { Users, UserPlus, Search, Edit, Trash2, KeyRound, UserCircle, Loader2, FileUp, FileText, UploadCloud, Download, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";


const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const VALID_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const VALID_EXTENSIONS = ['.csv', '.xls', '.xlsx'];

const workerSchema = z.object({
  dni: z.string().length(8, "El DNI debe tener 8 dígitos.").regex(/^\d{8}$/, "El DNI solo debe contener números."),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres.").max(100, "El nombre no debe exceder los 100 caracteres."),
});

type WorkerFormValues = z.infer<typeof workerSchema>;

export default function WorkerMasterManagement() {
  const { toast } = useToast();
  const [workerMaster, setWorkerMaster] = useState<WorkerMasterItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerMasterItem | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<WorkerMasterItem | null>(null);
  const [isDeleteAllAlertOpen, setIsDeleteAllAlertOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "maestro-trabajadores"), (snapshot) => {
        const workers = snapshot.docs.map(doc => doc.data() as WorkerMasterItem);
        setWorkerMaster(workers);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching worker master data: ", error);
        toast({
            title: "Error de Carga",
            description: "No se pudieron obtener los datos de los trabajadores.",
            variant: "destructive",
        });
        setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);


  const addWorkerMasterItem = async (workerData: { dni: string; name: string }) => {
    const existingWorker = workerMaster.find(w => w.dni === workerData.dni);
    if(existingWorker) {
      throw new Error("Ya existe un trabajador con este DNI.");
    }
    const now = new Date().toISOString();
    const newWorker: WorkerMasterItem = { ...workerData, createdAt: now, updatedAt: now };
    await setDoc(doc(db, "maestro-trabajadores", newWorker.dni), newWorker);
  }

  const updateWorkerMasterItem = async (dni: string, newName: string) => {
    const workerRef = doc(db, "maestro-trabajadores", dni);
    await updateDoc(workerRef, { name: newName, updatedAt: new Date().toISOString() });
  }

  const deleteWorkerMasterItem = async (dni: string) => {
    await deleteDoc(doc(db, "maestro-trabajadores", dni));
  }

  const setWorkerMasterList = async (newList: WorkerMasterItem[]) => {
    const batch = writeBatch(db);
    const currentWorkersSnapshot = await getDocs(collection(db, "maestro-trabajadores"));
    currentWorkersSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    newList.forEach(worker => {
      const docRef = doc(db, "maestro-trabajadores", worker.dni);
      batch.set(docRef, worker);
    });

    await batch.commit();
  }

  const deleteAllWorkerMasterItems = async () => {
    const batch = writeBatch(db);
    const workersSnapshot = await getDocs(collection(db, "maestro-trabajadores"));
    workersSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }


  const addForm = useForm<WorkerFormValues>({
    resolver: zodResolver(workerSchema),
    defaultValues: { dni: '', name: '' },
  });

  const editForm = useForm<WorkerFormValues>({
    resolver: zodResolver(workerSchema),
    defaultValues: { dni: '', name: '' },
  });

  useEffect(() => {
    if (editingWorker) {
      editForm.reset({ dni: editingWorker.dni, name: editingWorker.name });
    }
  }, [editingWorker, editForm]);

  const filteredWorkers = useMemo(() => {
    if (!searchTerm) return workerMaster;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return workerMaster.filter(
      (worker) =>
        worker.name.toLowerCase().includes(lowerSearchTerm) ||
        worker.dni.includes(lowerSearchTerm)
    );
  }, [workerMaster, searchTerm]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setSelectedFile(null);

    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const isValidMimeType = VALID_MIME_TYPES.includes(file.type);
      const isValidExtension = VALID_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));

      if (!isValidMimeType && !isValidExtension) {
        const errorMessage = "Tipo de archivo no válido. Seleccione CSV o Excel (.csv, .xls, .xlsx).";
        setFileError(errorMessage);
        toast({ title: "Archivo No Válido", description: errorMessage, variant: "destructive" });
        if(fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const errorMessage = `Archivo excede 5MB. Tamaño: ${(file.size / (1024*1024)).toFixed(2)}MB`;
        setFileError(errorMessage);
        toast({ title: "Archivo Demasiado Grande", description: errorMessage, variant: "destructive" });
        if(fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
    }
  };

  const processAndSaveWorkerListToFirestore = async (data: any[][]) => {
    if (!data || data.length === 0) {
      throw new Error("El archivo seleccionado está vacío o no contiene datos interpretables.");
    }

    let dataToProcess = data;
    if (data.length > 0) {
        const firstRow = data[0];
        if (typeof firstRow[0] === 'string' && typeof firstRow[1] === 'string' &&
            firstRow[0].toLowerCase().includes('dni') &&
            (firstRow[1].toLowerCase().includes('nombre') || firstRow[1].toLowerCase().includes('name'))) {
            dataToProcess = data.slice(1);
        }
    }

    const newWorkerList: WorkerMasterItem[] = dataToProcess
      .map((row, index) => {
        const dni = row[0]?.toString().trim();
        const name = row[1]?.toString().trim();
        if (!dni || !name) {
          console.warn(`Fila ${index + (data.length > dataToProcess.length ? 2 : 1)} ignorada: DNI o nombre vacíos.`);
          return null;
        }
        if (!/^\d{8}$/.test(dni)) {
          console.warn(`Fila ${index + (data.length > dataToProcess.length ? 2 : 1)} ignorada: DNI '${dni}' inválido.`);
          return null;
        }
        const now = new Date().toISOString();
        return { dni, name, createdAt: now, updatedAt: now };
      })
      .filter((item): item is WorkerMasterItem => item !== null);

    if (newWorkerList.length === 0) {
      throw new Error("No se pudieron extraer datos válidos del archivo. Asegúrese de que el formato sea dos columnas: DNI y Nombre. Los encabezados son opcionales.");
    }

    try {
      await setWorkerMasterList(newWorkerList);
    } catch (err: any) {
      console.error("Error llamando a setWorkerMasterList desde el contexto:", err);
      throw new Error(`Error al guardar en base de datos: ${err.message}`);
    }

    toast({
      title: "Maestro de Trabajadores Actualizado",
      description: `Se procesaron y guardaron ${newWorkerList.length} trabajadores.`,
    });
  };

  const handleProcessFile = async () => {
    if (!selectedFile) {
      setFileError("Por favor, seleccione un archivo para procesar.");
      toast({ title: "Error", description: "Por favor, seleccione un archivo.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setFileError(null);

    try {
      toast({ title: "Procesando archivo...", description: `Leyendo ${selectedFile.name}.` });
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("El archivo Excel no contiene hojas.");
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false }) as any[][];

      await processAndSaveWorkerListToFirestore(data);
      setFileError(null);

      setSelectedFile(null);
      if(fileInputRef.current) fileInputRef.current.value = "";

    } catch (err: any) {
      console.error("Error en carga masiva de trabajadores:", err);
      setFileError(err.message || "Error durante el procesamiento.");
      toast({ title: "Error en Carga Masiva", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };


  const handleAddWorker: SubmitHandler<WorkerFormValues> = async (data) => {
    setIsProcessing(true);
    try {
      await addWorkerMasterItem({ dni: data.dni, name: data.name });
      toast({ title: "Trabajador Agregado", description: `El trabajador ${data.name} ha sido agregado.` });
      addForm.reset();
      setIsAddModalOpen(false);
    } catch (err: any) {
      toast({ title: "Error al Agregar", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditWorkerClick = (worker: WorkerMasterItem) => {
    setEditingWorker(worker);
    setIsEditModalOpen(true);
  };

  const handleUpdateWorker: SubmitHandler<WorkerFormValues> = async (data) => {
    if (!editingWorker) return;
    setIsProcessing(true);
    try {
      await updateWorkerMasterItem(editingWorker.dni, data.name);
      toast({ title: "Trabajador Actualizado", description: `El trabajador ${data.name} ha sido actualizado.` });
      setIsEditModalOpen(false);
      setEditingWorker(null);
    } catch (err: any) {
      toast({ title: "Error al Actualizar", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteWorkerClick = (worker: WorkerMasterItem) => {
    setWorkerToDelete(worker);
  };

  const handleConfirmDelete = async () => {
    if (!workerToDelete) return;
    setIsProcessing(true);
    try {
      await deleteWorkerMasterItem(workerToDelete.dni);
      toast({ title: "Trabajador Eliminado", description: `El trabajador ${workerToDelete.name} ha sido eliminado.` });
      setWorkerToDelete(null);
    } catch (err: any) {
      toast({ title: "Error al Eliminar", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadMaster = () => {
    if (workerMaster.length === 0) {
      toast({ title: "Maestro Vacío", description: "No hay trabajadores para descargar." });
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(workerMaster.map(item => ({ DNI: item.dni, Nombre: item.name })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "MaestroDeTrabajadores");
    XLSX.writeFile(workbook, "Maestro_De_Trabajadores.xlsx");
    toast({ title: "Descarga Iniciada", description: "El archivo Maestro_De_Trabajadores.xlsx se está descargando." });
  };

  const handleConfirmDeleteAll = async () => {
    setIsProcessing(true);
    try {
      await deleteAllWorkerMasterItems();
      toast({ title: "Maestro Eliminado", description: "Todos los trabajadores han sido eliminados del maestro." });
      setIsDeleteAllAlertOpen(false);
    } catch (err: any) {
      toast({ title: "Error al Eliminar Todo", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };


  if (loading && workerMaster.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Cargando maestro de trabajadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4">
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl font-headline text-center">Carga Masiva de Trabajadores</CardTitle>
          <CardDescription className="text-center">
            Seleccione un archivo Excel (.xls, .xlsx) o CSV (.csv) de máximo 5MB.
            Debe tener dos columnas: <strong>DNI</strong> (1ra) y <strong>Nombre</strong> (2da).
            Esta acción reemplazará la lista actual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            ref={fileInputRef}
            accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .xls, .xlsx"
            onChange={handleFileChange}
            className="hidden"
            id="worker-master-file-input"
            disabled={isProcessing}
          />
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full" disabled={isProcessing}>
            <FileUp className="mr-2 h-4 w-4" /> Seleccionar Archivo
          </Button>
          {selectedFile && !fileError && (
            <div className="text-sm text-muted-foreground p-2 border rounded-md flex items-center">
                <FileText className="mr-2 h-4 w-4 text-primary" />
                Archivo: {selectedFile.name} ({(selectedFile.size / (1024*1024)).toFixed(2)} MB)
            </div>
          )}
          {fileError && (
             <Alert variant="destructive" className="mt-4 whitespace-pre-wrap">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleProcessFile} className="w-full md:w-auto ml-auto" disabled={!selectedFile || isProcessing || !!fileError}>
            {isProcessing ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <UploadCloud className="mr-2 h-4 w-4" /> )}
            {isProcessing ? 'Procesando...' : 'Procesar y Guardar Archivo'}
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl font-headline flex items-center">
                <Users className="mr-2 h-6 w-6 text-primary" /> Lista de Trabajadores
              </CardTitle>
              <CardDescription>Administre la lista de trabajadores de la empresa.</CardDescription>
            </div>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" /> Agregar Trabajador (Manual)
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Agregar Nuevo Trabajador</DialogTitle>
                </DialogHeader>
                <Form {...addForm}>
                  <form onSubmit={addForm.handleSubmit(handleAddWorker)} className="space-y-4 py-4">
                    <FormField control={addForm.control} name="dni" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4"/>DNI</FormLabel>
                          <FormControl><Input placeholder="DNI de 8 dígitos" {...field} maxLength={8} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={addForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><UserCircle className="mr-2 h-4 w-4"/>Nombre Completo</FormLabel>
                          <FormControl><Input placeholder="Nombre completo del trabajador" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline" disabled={isProcessing}>Cancelar</Button></DialogClose>
                      <Button type="submit" disabled={isProcessing}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Agregar
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="pt-4 space-y-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar por DNI o nombre..."
                        className="w-full pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleDownloadMaster} disabled={workerMaster.length === 0 || isProcessing}>
                        <Download className="mr-2 h-4 w-4" /> Descargar (Excel)
                    </Button>
                    <AlertDialog open={isDeleteAllAlertOpen} onOpenChange={setIsDeleteAllAlertOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={workerMaster.length === 0 || isProcessing}>
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar Todo
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente <strong>todos</strong> los trabajadores del maestro.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDeleteAll} className="bg-destructive hover:bg-destructive/90" disabled={isProcessing}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sí, eliminar todo
                            </AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-30rem)] min-h-[250px]">
            {filteredWorkers.length > 0 ? (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>DNI</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.map((worker) => (
                    <TableRow key={worker.dni}>
                      <TableCell className="font-medium">{worker.dni}</TableCell>
                      <TableCell>{worker.name}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button variant="outline" size="icon" onClick={() => handleEditWorkerClick(worker)} title="Editar Trabajador" disabled={isProcessing}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteWorkerClick(worker)} title="Eliminar Trabajador" disabled={isProcessing}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {workerMaster.length === 0 ? "No hay trabajadores registrados." : "No se encontraron trabajadores que coincidan con la búsqueda."}
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Trabajador</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateWorker)} className="space-y-4 py-4">
              <FormField control={editForm.control} name="dni" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><KeyRound className="mr-2 h-4 w-4"/>DNI</FormLabel>
                    <FormControl><Input {...field} readOnly disabled /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={editForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><UserCircle className="mr-2 h-4 w-4"/>Nombre Completo</FormLabel>
                    <FormControl><Input placeholder="Nombre completo del trabajador" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isProcessing}>Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!workerToDelete} onOpenChange={(open) => !open && setWorkerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente al trabajador
              <span className="font-semibold"> {workerToDelete?.name} (DNI: {workerToDelete?.dni})</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWorkerToDelete(null)} disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
