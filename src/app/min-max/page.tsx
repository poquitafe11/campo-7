"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
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
import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, getDocs } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LoteData, Labor } from "@/lib/types";

const minMaxSchema = z.object({
    campana: z.string().min(1, "La campaña es requerida"),
    lote: z.string().min(1, "El lote es requerido"),
    codigo: z.string().min(1, "El código es requerido"),
    labor: z.string().min(1, "La labor es requerida"),
    pasada: z.coerce.number().int().min(0, "Debe ser un número entero no negativo"),
    min: z.coerce.number(),
    max: z.coerce.number(),
}).refine(data => data.max >= data.min, {
    message: "El valor máximo no puede ser menor que el mínimo.",
    path: ["max"],
});


type MinMax = z.infer<typeof minMaxSchema> & { id: string };

function normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/ó/g, 'o').replace(/ /g, '').replace(/\./g, '');
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
                
                const schemaKeys = Object.keys(minMaxSchema.shape);
                schemaKeys.forEach(field => {
                    const normalizedField = normalizeKey(field);
                    const foundKey = header.find(h => normalizeKey(h) === normalizedField);
                    if (foundKey) keyMap[field] = foundKey;
                });
                
                if (!keyMap.campana || !keyMap.lote || !keyMap.codigo || !keyMap.labor || !keyMap.pasada || !keyMap.min || !keyMap.max) {
                   return reject(new Error("El archivo debe contener columnas para Campaña, Lote, Codigo, Labor, Pasada, Min y Max."));
                }

                const laborsSnapshot = await getDocs(collection(db, 'maestro-labores'));
                const laborsData = laborsSnapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() })) as Labor[];

                const normalizedData = json.map(row => {
                    try {
                        const rowData: any = {};
                        for (const field in keyMap) {
                            const excelKey = keyMap[field];
                            let value = row[excelKey];
                            const fieldSchema = (minMaxSchema.shape as any)[field];

                             if (value === undefined || value === null || String(value).trim() === '') continue;

                            if (fieldSchema._def.typeName === "ZodNumber") {
                                const num = parseFloat(String(value).replace(',', '.'));
                                if (!isNaN(num)) rowData[field] = num;
                            } else {
                                rowData[field] = String(value).trim();
                            }
                        }

                        // Auto-fill labor from code
                        const matchedLabor = laborsData.find(l => l.codigo === rowData.codigo);
                        if (matchedLabor) {
                            rowData.labor = matchedLabor.descripcion;
                        }
                        
                        const validatedData = minMaxSchema.partial().parse(rowData);
                        
                        if (!validatedData.campana || !validatedData.lote || !validatedData.codigo) return null;
                        
                        const id = `${validatedData.campana}-${validatedData.lote}-${validatedData.codigo}-${validatedData.pasada || 0}`;
                        
                        return { ...validatedData, id };

                    } catch(err) {
                        console.warn('Fila omitida por error de parseo:', row, err);
                        return null;
                    }
                }).filter((item): item is MinMax => item !== null);


                if (normalizedData.length === 0) {
                    return reject(new Error("No se encontraron datos válidos en el archivo."));
                }

                const batch = writeBatch(db);
                normalizedData.forEach((item) => {
                  if (item && item.id) {
                    const docRef = doc(db, 'min-max', item.id);
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
        reader.readAsBinaryString(file);
    });
}


export default function MinMaxPage() {
  const [data, setData] = useState<MinMax[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<MinMax | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [lotes, setLotes] = useState<LoteData[]>([]);
  const [labors, setLabors] = useState<Labor[]>([]);

  useEffect(() => {
    async function loadMasterData() {
        try {
            const [lotesSnapshot, laborsSnapshot] = await Promise.all([
                getDocs(collection(db, 'maestro-lotes')),
                getDocs(collection(db, 'maestro-labores')),
            ]);
            const lotesData = lotesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoteData));
            const sortedLotes = lotesData.sort((a,b) => a.lote.localeCompare(b.lote, undefined, { numeric: true }));
            setLotes(sortedLotes);

            const laborsData = laborsSnapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() } as Labor));
            setLabors(laborsData);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos maestros.' });
        }
    }
    loadMasterData();
  }, [toast]);


  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "min-max"), (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({ ...doc.data() } as MinMax));
      const sortedData = recordsData.sort((a,b) => a.id.localeCompare(b.id));
      setData(sortedData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching data from Firestore: ", error);
      toast({ title: "Error de Conexión", description: "No se pudieron cargar los datos.", variant: "destructive" });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);

  const form = useForm<z.infer<typeof minMaxSchema>>({
    resolver: zodResolver(minMaxSchema),
  });

  const codeValue = form.watch("codigo");

  useEffect(() => {
      if(codeValue) {
        const matchedLabor = labors.find(l => l.codigo === codeValue);
        form.setValue('labor', matchedLabor?.descripcion || '', { shouldValidate: true });
      } else {
        form.setValue('labor', '', { shouldValidate: true });
      }
  }, [codeValue, labors, form]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  };
  
  const handleDownload = () => {
    const dataToExport = table.getFilteredRowModel().rows.map(row => row.original);
    const worksheet = xlsx.utils.json_to_sheet(dataToExport.map(({ id, ...rest }) => rest));
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "MinMax");
    xlsx.writeFile(workbook, "MinMax.xlsx");
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
        await deleteDoc(doc(db, "min-max", id));
        toast({ title: "Éxito", description: "Registro eliminado correctamente." });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo eliminar el registro.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: z.infer<typeof minMaxSchema>) => {
    try {
        const id = `${values.campana}-${values.lote}-${values.codigo}-${values.pasada}`;
        const docRef = doc(db, "min-max", id);
        
        await setDoc(docRef, { ...values, id }, { merge: true });

        if (editingRecord) {
            if (editingRecord.id !== id) {
                await deleteDoc(doc(db, "min-max", editingRecord.id));
            }
            toast({ title: "Éxito", description: "Registro actualizado correctamente." });
            setEditingRecord(null);
        } else {
            toast({ title: "Éxito", description: "Registro creado correctamente." });
            setCreateDialogOpen(false);
        }
        form.reset({ campana: '', lote: '', codigo: '', labor: '', pasada: 0, min: 0, max: 0 });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo guardar el registro.", variant: "destructive" });
    }
  };

  const columns = useMemo<ColumnDef<MinMax>[]>(
    () => [
      { accessorKey: "campana", header: "Campaña" },
      { accessorKey: "lote", header: "Lote" },
      { accessorKey: "codigo", header: "Código" },
      { accessorKey: "labor", header: "Labor", cell: ({ row }) => <div className="min-w-[200px]">{row.original.labor}</div> },
      { accessorKey: "pasada", header: "Pasada" },
      { accessorKey: "min", header: "Min" },
      { accessorKey: "max", header: "Max" },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => {
                setEditingRecord(row.original);
                form.reset(row.original);
            }}>
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

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), onColumnFiltersChange: setColumnFilters, getFilteredRowModel: getFilteredRowModel(), state: { columnFilters } });

  const renderFormFields = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
        <FormField control={form.control} name="campana" render={({ field }) => ( <FormItem><FormLabel>Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="lote" render={({ field }) => ( <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl><SelectContent>{lotes.map(l => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="codigo" render={({ field }) => ( <FormItem><FormLabel>Código</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="labor" render={({ field }) => ( <FormItem><FormLabel>Labor</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="pasada" render={({ field }) => ( <FormItem><FormLabel>Pasada</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="min" render={({ field }) => ( <FormItem><FormLabel>Min</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="max" render={({ field }) => ( <FormItem><FormLabel>Max</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
    </div>
  );

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <PageHeaderWithNav title="Maestro de Mínimos y Máximos" />
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <Input placeholder="Buscar por labor..." value={(table.getColumn('labor')?.getFilterValue() as string) ?? ''} onChange={(event) => table.getColumn('labor')?.setFilterValue(event.target.value)} className="max-w-sm w-full h-9" />
              <div className="flex gap-2 w-full sm:w-auto">
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} />
                  <Tooltip><TooltipTrigger asChild><Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="h-9"><FileUp className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Seleccionar Excel</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button onClick={handleDownload} variant="outline" size="sm" disabled={table.getRowModel().rows.length === 0} className="h-9"><FileDown className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Descargar Excel</p></TooltipContent></Tooltip>
                  <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => { setCreateDialogOpen(isOpen); if (!isOpen) form.reset(); }}>
                      <DialogTrigger asChild><Button size="sm" className="h-9"><PlusCircle className="mr-2 h-4 w-4" />Agregar</Button></DialogTrigger>
                      <DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Agregar Nuevo Registro</DialogTitle></DialogHeader><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">{renderFormFields()}<DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter></form></Form></DialogContent>
                  </Dialog>
              </div>
          </div>

          {selectedFile && ( <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50"><span className="flex-grow text-sm font-medium text-muted-foreground truncate">{selectedFile.name}</span><Button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} variant="ghost" size="icon"><X className="h-4 w-4" /></Button><Button size="sm" onClick={handleConfirmUpload} disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}{isUploading ? 'Subiendo...' : 'Confirmar'}</Button></div> )}

          <div className="rounded-md border"><Table><TableHeader>{table.getHeaderGroups().map((headerGroup) => ( <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => ( <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead> ))}</TableRow> ))}</TableHeader><TableBody>{loading ? ( <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow> ) : table.getRowModel().rows?.length ? ( table.getRowModel().rows.map((row) => ( <TableRow key={row.id}>{row.getVisibleCells().map((cell) => ( <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell> ))}</TableRow> )) ) : ( <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay datos.</TableCell></TableRow> )}</TableBody></Table></div>
          <div className="flex items-center justify-between gap-2 flex-wrap"><div className="flex items-center gap-2"><Select value={`${table.getState().pagination.pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}><SelectTrigger className="w-[70px] h-9"><SelectValue placeholder={table.getState().pagination.pageSize} /></SelectTrigger><SelectContent>{[10, 20, 50, 100].map((pageSize) => ( <SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem> ))}</SelectContent></Select><span className="text-sm text-muted-foreground">Fila {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}-{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "} de {table.getFilteredRowModel().rows.length}</span></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="h-9 w-9"><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-9 w-9"><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Página {table.getPageCount() > 0 ? table.getState().pagination.pageIndex + 1 : 0} de {table.getPageCount()}</span><Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-9 w-9"><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="h-9 w-9"><ChevronsRight className="h-4 w-4" /></Button></div></div>
          <Dialog open={!!editingRecord} onOpenChange={(open) => { if (!open) setEditingRecord(null); }}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Editar Registro</DialogTitle></DialogHeader><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">{renderFormFields()}<DialogFooter><DialogClose asChild><Button type="button" variant="secondary" onClick={() => setEditingRecord(null)}>Cancelar</Button></DialogClose><Button type="submit">Guardar Cambios</Button></DialogFooter></form></Form></DialogContent></Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
}
