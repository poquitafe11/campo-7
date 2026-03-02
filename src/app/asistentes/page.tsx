
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as xlsx from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PlusCircle,
  FileUp,
  FileDown,
  Loader2,
  CircleCheck,
  X,
} from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMasterData } from "@/context/MasterDataContext";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

const asistenteSchema = z.object({
    dni: z.string().min(1, "El DNI/ID es requerido"),
    nombre: z.string().min(1, "El nombre es requerido"),
    cargo: z.string().min(1, "El cargo es requerido"),
});

type Asistente = {
  id: string;
  assistantName: string;
  cargo: string;
  personnelCount?: number;
  absentCount?: number;
} & { dni?: string; nombre?: string };


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


export default function AsistentesPage() {
  const { asistentes, loading: masterLoading } = useMasterData();
  const { setActions } = useHeaderActions();
  const [data, setData] = useState<Asistente[]>([]);
  const [editingAsistente, setEditingAsistente] = useState<Asistente | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setActions({ title: "Gestión de Asistentes" });
    return () => setActions({});
  }, [setActions]);

  useEffect(() => {
    const formattedData: Asistente[] = asistentes.map(a => ({
        id: a.id,
        dni: a.id,
        nombre: a.assistantName,
        assistantName: a.assistantName,
        cargo: a.cargo
    })).sort((a,b) => (a.nombre || '').localeCompare(b.nombre || ''));

    setData(formattedData);
  }, [asistentes]);


  const form = useForm<z.infer<typeof asistenteSchema>>({
    resolver: zodResolver(asistenteSchema),
    defaultValues: { dni: "", nombre: "", cargo: "" }
  });
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };
  
  const handleDownload = () => {
    const dataToExport = table.getFilteredRowModel().rows.map(row => row.original);
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Maestro de Asistentes");
    xlsx.writeFile(workbook, "MaestroDeAsistentes.xlsx");
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const { count } = await processAndUploadFile(selectedFile);
      toast({ title: "Éxito", description: `${count} registros cargados/actualizados.` });
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

  const handleDelete = async (dni: string) => {
    try {
        await deleteDoc(doc(db, "asistentes", dni));
        toast({ title: "Éxito", description: "Registro eliminado correctamente." });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo eliminar el registro.", variant: "destructive" });
        console.error("Error deleting document: ", error);
    }
  };

  const handleDeleteAll = async () => {
    if (data.length === 0) return;
    try {
      const batch = writeBatch(db);
      data.forEach((asistente) => {
        const docRef = doc(db, "asistentes", asistente.id);
        batch.delete(docRef);
      });
      await batch.commit();
      toast({ title: "Éxito", description: `Se eliminaron ${data.length} registros.` });
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron eliminar todos los registros.", variant: "destructive" });
      console.error("Error deleting all documents: ", error);
    }
  };

  const handleEdit = (asistente: Asistente) => {
    setEditingAsistente(asistente);
    form.reset({
        dni: asistente.id,
        nombre: asistente.assistantName,
        cargo: asistente.cargo
    });
  };

  const onSubmit = async (values: z.infer<typeof asistenteSchema>) => {
    try {
        const docRef = doc(db, "asistentes", values.dni);
        
        await setDoc(docRef, { nombre: values.nombre, cargo: values.cargo }, { merge: true });

        if (editingAsistente) {
            if (editingAsistente.id !== values.dni) {
                await deleteDoc(doc(db, "asistentes", editingAsistente.id));
            }
            toast({ title: "Éxito", description: "Registro actualizado correctamente." });
            setEditingAsistente(null);
        } else {
            toast({ title: "Éxito", description: "Registro creado correctamente." });
            setCreateDialogOpen(false);
        }
        form.reset({ dni: "", nombre: "", cargo: "" });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo guardar el registro.", variant: "destructive" });
        console.error("Error saving document: ", error);
    }
  };

  const columns = useMemo<ColumnDef<Asistente>[]>(
    () => [
      { accessorKey: "dni", header: "DNI / ID" },
      { accessorKey: "nombre", header: "Nombre" },
      { accessorKey: "cargo", header: "Cargo" },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Esto eliminará permanentemente el registro.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(row.original.id)}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: { columnFilters }
  });

  const renderFormFields = () => (
    <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto p-1">
        <FormField control={form.control} name="dni" render={({ field }) => ( <FormItem><FormLabel>DNI / ID</FormLabel><FormControl><Input {...field} disabled={!!editingAsistente} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="nombre" render={({ field }) => ( <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="cargo" render={({ field }) => ( <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Input
                placeholder="Buscar por DNI/ID..."
                value={(table.getColumn('dni')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                  table.getColumn('dni')?.setFilterValue(event.target.value)
                }
                className="max-w-sm w-full h-9"
            />
            <div className="flex gap-2 w-full sm:w-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileSelect}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="h-9">
                      <FileUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cargar desde Excel</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleDownload} variant="outline" size="sm" disabled={table.getRowModel().rows.length === 0} className="h-9">
                      <FileDown className="h-4 w-4" /> 
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Descargar a Excel</p>
                  </TooltipContent>
                </Tooltip>
                
                <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => {
                    setCreateDialogOpen(isOpen);
                    if (!isOpen) form.reset({ dni: "", nombre: "", cargo: "" });
                }}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="h-9">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Agregar
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Agregar Nuevo Asistente</DialogTitle></DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {renderFormFields()}
                                <DialogFooter>
                                    <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                                    <Button type="submit">Guardar</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={data.length === 0} className="h-9">
                              <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Eliminar Todo</p>
                        </TooltipContent>
                      </Tooltip>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará permanentemente los {data.length} registros.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAll}>Sí, eliminar todo</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
            <span className="flex-grow text-sm font-medium text-muted-foreground truncate">{selectedFile.name}</span>
            <Button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} variant="ghost" size="icon">
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleConfirmUpload} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleCheck className="mr-2 h-4 w-4" />}
              {isUploading ? 'Subiendo...' : 'Confirmar'}
            </Button>
          </div>
        )}

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
              {masterLoading ? (
                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>{row.getVisibleCells().map((cell) => ( <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell> ))}</TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay datos. Agrega un registro o sube un archivo para empezar.</TableCell></TableRow>
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

        <Dialog open={!!editingAsistente} onOpenChange={(open) => {
            if (!open) setEditingAsistente(null);
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Editar Asistente</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {renderFormFields()}
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary" onClick={() => setEditingAsistente(null)}>Cancelar</Button></DialogClose>
                            <Button type="submit">Guardar Cambios</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
