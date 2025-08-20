"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
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
import { PageHeader } from "@/components/PageHeader";
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
  CheckCircle,
  X,
  Filter,
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, query, where, getDocs } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";


const presupuestoSchema = z.object({
  campana: z.string().min(1, "La campaña es requerida."),
  descripcionLabor: z.string().min(1, "La descripción es requerida"),
  lote: z.string().min(1, "El lote es requerido"),
  jornadas: z.coerce.number().positive("Debe ser un número positivo"),
  jrnHa: z.coerce.number().positive("Debe ser un número positivo"),
});

type Presupuesto = z.infer<typeof presupuestoSchema> & { id: string };

function normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/ó/g, 'o').replace(/\s+/g, '').replace(/[\.\/]/g, '');
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
                const json: any[] = xlsx.utils.sheet_to_json(worksheet, { raw: false });

                if (json.length === 0) {
                    return reject(new Error("El archivo está vacío o no tiene el formato correcto."));
                }

                const header = Object.keys(json[0]);
                const keyMap: { [key: string]: string } = {};

                const schemaKeys = {
                    campana: 'campana',
                    descripcionLabor: 'descripcionlabor',
                    lote: 'lote',
                    jornadas: 'jornadas',
                    jrnHa: 'jrnha'
                };
                
                Object.entries(schemaKeys).forEach(([field, normalizedField]) => {
                    const foundKey = header.find(h => normalizeKey(h) === normalizedField);
                    if (foundKey) keyMap[field] = foundKey;
                });

                if (!keyMap.campana || !keyMap.descripcionLabor || !keyMap.lote || !keyMap.jornadas || !keyMap.jrnHa) {
                   return reject(new Error("El archivo debe contener columnas para 'CAMPAÑA', 'DESCRIPCION LABOR', 'LOTE', 'JORNADAS' y 'JRN/HA'."));
                }
                
                const normalizedData = json.map((row, index) => {
                    try {
                        const rowData: any = {};
                         for (const field in keyMap) {
                            const excelKey = keyMap[field];
                            let value = row[excelKey];
                             if (value === undefined || value === null || String(value).trim() === '') return null;
                            rowData[field] = value;
                        }

                        const validatedData = presupuestoSchema.parse(rowData);
                        const sanitizedDesc = validatedData.descripcionLabor.replace(/[\s\/]/g, '-');
                        const sanitizedLote = String(validatedData.lote).replace(/[\s\/]/g, '-');
                        const id = `${validatedData.campana}-${sanitizedLote}-${sanitizedDesc}-${Date.now()}-${index}`;
                        
                        return { ...validatedData, id };

                    } catch(err) {
                        console.warn('Fila omitida por error de parseo:', row, err);
                        return null;
                    }
                }).filter((item): item is Presupuesto => item !== null);


                if (normalizedData.length === 0) {
                    return reject(new Error("No se encontraron datos válidos en el archivo."));
                }

                const batch = writeBatch(db);
                normalizedData.forEach((item) => {
                  if (item && item.id) {
                    const docRef = doc(db, 'presupuesto', item.id);
                    batch.set(docRef, item, { merge: true });
                  }
                });

                await batch.commit();
                resolve({ count: normalizedData.length });

            } catch (error: any) {
                console.error('Error processing or uploading file: ', error);
                reject(new Error(error.message || 'Hubo un error al procesar el archivo.'));
            }
        };
        reader.onerror = (error) => reject(new Error('Error al leer el archivo.'));
    });
}


export default function PresupuestoPage() {
  const [data, setData] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<Presupuesto | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [loteFilter, setLoteFilter] = useState('');
  const [laborFilter, setLaborFilter] = useState('');
  
  const defaultFormValues = {
    campana: "",
    descripcionLabor: "",
    lote: "",
    jornadas: 0,
    jrnHa: 0,
  };

  const fetchAndSetData = useCallback(() => {
    setLoading(true);
    let q = query(collection(db, "presupuesto"));

    if (loteFilter) {
      q = query(q, where("lote", "==", loteFilter));
    }
    if (laborFilter) {
      q = query(q, where("descripcionLabor", "==", laborFilter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const recordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Presupuesto));
        setData(recordsData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching data from Firestore: ", error);
        toast({ title: "Error de Conexión", description: "No se pudieron cargar los datos.", variant: "destructive" });
        setLoading(false);
    });
    return unsubscribe;
  }, [toast, loteFilter, laborFilter]);
  
  useEffect(() => {
    const unsubscribe = fetchAndSetData();
    return () => unsubscribe();
  }, [fetchAndSetData]);


  const form = useForm<z.infer<typeof presupuestoSchema>>({
    resolver: zodResolver(presupuestoSchema),
    defaultValues: defaultFormValues,
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  };
  
  const handleDownload = () => {
    const dataToExport = table.getRowModel().rows.map(row => row.original);
    const worksheet = xlsx.utils.json_to_sheet(dataToExport.map(({ id, ...rest }) => ({
        "CAMPAÑA": rest.campana,
        "DESCRIPCION LABOR": rest.descripcionLabor,
        "LOTE": rest.lote,
        "JORNADAS": rest.jornadas,
        "JRN/HA": rest.jrnHa
    })));
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Presupuesto");
    xlsx.writeFile(workbook, "MaestroDePresupuesto.xlsx");
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
        await deleteDoc(doc(db, "presupuesto", id));
        toast({ title: "Éxito", description: "Registro eliminado correctamente." });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo eliminar el registro.", variant: "destructive" });
    }
  };

  const handleDeleteAll = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "presupuesto"));
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: "Éxito", description: `${querySnapshot.size} registros eliminados.` });
      } catch (error) {
        console.error("Error deleting all documents:", error);
        toast({ title: "Error", description: "No se pudieron eliminar todos los registros.", variant: "destructive" });
      }
  };

  const handleEdit = (record: Presupuesto) => {
    setEditingRecord(record);
    form.reset(record);
    setCreateDialogOpen(true);
  };
  
  const handleCreate = () => {
    setEditingRecord(null);
    form.reset(defaultFormValues);
    setCreateDialogOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof presupuestoSchema>) => {
    try {
        const sanitizedDesc = values.descripcionLabor.replace(/[\s\/]/g, '-');
        const sanitizedLote = String(values.lote).replace(/[\s\/]/g, '-');
        let id = editingRecord ? editingRecord.id : `${values.campana}-${sanitizedLote}-${sanitizedDesc}-${Date.now()}`;
        
        const docRef = doc(db, "presupuesto", id);
        
        await setDoc(docRef, { ...values, id }, { merge: true });

        if (editingRecord) {
            toast({ title: "Éxito", description: "Registro actualizado correctamente." });
        } else {
            toast({ title: "Éxito", description: "Registro creado correctamente." });
        }
        setCreateDialogOpen(false);
        setEditingRecord(null);
    } catch (error) {
        toast({ title: "Error", description: "No se pudo guardar el registro.", variant: "destructive" });
    }
  };

  const columns = useMemo<ColumnDef<Presupuesto>[]>(
    () => [
      { accessorKey: "campana", header: "CAMPAÑA" },
      { accessorKey: "descripcionLabor", header: "DESCRIPCION LABOR" },
      { accessorKey: "lote", header: "LOTE" },
      { accessorKey: "jornadas", header: "JORNADAS" },
      { accessorKey: "jrnHa", header: "JRN/HA" },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => handleEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(row.original.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel() });

  const renderFormFields = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
      <FormField control={form.control} name="campana" render={({ field }) => ( <FormItem><FormLabel>Campaña</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={form.control} name="descripcionLabor" render={({ field }) => ( <FormItem><FormLabel>Descripción Labor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={form.control} name="lote" render={({ field }) => ( <FormItem><FormLabel>Lote</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={form.control} name="jornadas" render={({ field }) => ( <FormItem><FormLabel>Jornadas</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
      <FormField control={form.control} name="jrnHa" render={({ field }) => ( <FormItem><FormLabel>JRN/HA</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
    </div>
  );
  
  return (
    <TooltipProvider>
      <>
        <PageHeader title="Maestro de Presupuesto" />
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
               <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Filter className="mr-2 h-4 w-4" />
                        Filtros
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                    <div className="grid gap-4">
                        <div className="space-y-2"><h4 className="font-medium leading-none">Filtros</h4></div>
                        <div className="grid gap-2">
                            <Label htmlFor="lote-filter">Buscar por Lote</Label>
                            <Input id="lote-filter" value={loteFilter} onChange={e => setLoteFilter(e.target.value)} placeholder="Escribe un lote..." />
                            <Label htmlFor="labor-filter">Buscar por Labor</Label>
                            <Input id="labor-filter" value={laborFilter} onChange={e => setLaborFilter(e.target.value)} placeholder="Escribe una labor..." />
                        </div>
                    </div>
                </PopoverContent>
              </Popover>
            </div>
              <div className="flex gap-2 w-full sm:w-auto">
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} />
                  <Tooltip><TooltipTrigger asChild><Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="h-9"><FileUp className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Seleccionar Excel</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button onClick={handleDownload} variant="outline" size="sm" disabled={table.getRowModel().rows.length === 0} className="h-9"><FileDown className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Descargar Excel</p></TooltipContent></Tooltip>
                  <Button size="sm" className="h-9" onClick={handleCreate}><PlusCircle className="mr-2 h-4 w-4" />Agregar</Button>
              </div>
          </div>

          {selectedFile && ( <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50"><span className="flex-grow text-sm font-medium text-muted-foreground truncate">{selectedFile.name}</span><Button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} variant="ghost" size="icon"><X className="h-4 w-4" /></Button><Button size="sm" onClick={handleConfirmUpload} disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}{isUploading ? 'Subiendo...' : 'Confirmar'}</Button></div> )}

          <div className="rounded-md border"><Table><TableHeader>{table.getHeaderGroups().map((headerGroup) => ( <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => ( <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead> ))}</TableRow> ))}</TableHeader><TableBody>{loading ? ( <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow> ) : table.getRowModel().rows?.length ? ( table.getRowModel().rows.map((row) => ( <TableRow key={row.id}>{row.getVisibleCells().map((cell) => ( <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell> ))}</TableRow> )) ) : ( <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay datos.</TableCell></TableRow> )}</TableBody></Table></div>
          <div className="flex items-center justify-between gap-2 flex-wrap"><div className="flex items-center gap-2"><Select value={`${table.getState().pagination.pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}><SelectTrigger className="w-[70px] h-9"><SelectValue placeholder={table.getState().pagination.pageSize} /></SelectTrigger><SelectContent>{[10, 20, 50, 100].map((pageSize) => ( <SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem> ))}</SelectContent></Select><span className="text-sm text-muted-foreground">Fila {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}-{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "} de {table.getFilteredRowModel().rows.length}</span></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="h-9 w-9"><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-9 w-9"><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Página {table.getPageCount() > 0 ? table.getState().pagination.pageIndex + 1 : 0} de {table.getPageCount()}</span><Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-9 w-9"><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="h-9 w-9"><ChevronsRight className="h-4 w-4" /></Button></div></div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => {
              setCreateDialogOpen(isOpen);
              if (!isOpen) {
                  setEditingRecord(null);
                  form.reset(defaultFormValues);
              }
          }}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingRecord ? "Editar Registro" : "Agregar Nuevo Registro"}</DialogTitle>
              </DialogHeader>
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

        </div>
      </>
    </TooltipProvider>
  );
}
