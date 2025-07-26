
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, getDocs, query } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMasterData } from "@/context/MasterDataContext";

const presupuestoSchema = z.object({
    descripcionLabor: z.string().min(1, "La descripción es requerida"),
    lote: z.string().min(1, "El lote es requerido"),
    jornadas: z.coerce.number().min(0, "Debe ser un número no negativo"),
    jrnHa: z.coerce.number().min(0, "Debe ser un número no negativo"),
});

type Presupuesto = z.infer<typeof presupuestoSchema> & { id: string };

function normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/ó/g, 'o').replace(/\s/g, '').replace(/\./g, '').replace(/\//g, '');
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
                
                const normalizedHeaderMap: { [key: string]: string } = {};
                header.forEach(h => {
                    normalizedHeaderMap[normalizeKey(h)] = h;
                });

                const descLaborKey = normalizedHeaderMap['descripcionlabor'];
                const loteKey = normalizedHeaderMap['lote'];
                const jornadasKey = normalizedHeaderMap['jornadas'];
                const jrnHaKey = normalizedHeaderMap['jrnha'];
                
                 if (!descLaborKey || !loteKey || !jornadasKey || !jrnHaKey) {
                   return reject(new Error("El archivo debe contener columnas para 'DESCRIPCION LABOR', 'LOTE', 'JORNADAS' y 'JRN/HA'."));
                }
                
                const normalizedData = json.map(row => {
                    try {
                        const rowData: any = {};
                        
                        rowData.descripcionLabor = String(row[descLaborKey] || '').trim();
                        rowData.lote = String(row[loteKey] || '').trim();
                        const jornadasVal = parseFloat(String(row[jornadasKey] || '0').replace(',', '.'));
                        const jrnHaVal = parseFloat(String(row[jrnHaKey] || '0').replace(',', '.'));

                        if (!isNaN(jornadasVal)) rowData.jornadas = jornadasVal;
                        if (!isNaN(jrnHaVal)) rowData.jrnHa = jrnHaVal;
                        
                        const validatedData = presupuestoSchema.partial().parse(rowData);
                        
                        if (!validatedData.descripcionLabor || !validatedData.lote) return null;
                        
                        const id = `${validatedData.descripcionLabor}-${validatedData.lote}`;
                        
                        return { ...validatedData, id, lote: validatedData.lote, descripcionLabor: validatedData.descripcionLabor, jornadas: validatedData.jornadas || 0, jrnHa: validatedData.jrnHa || 0 };

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
                    const { id, ...dataToSet } = item;
                    batch.set(docRef, dataToSet, { merge: true });
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
  const [fbLoading, setFbLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<Presupuesto | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { lotes, loading: masterLoading } = useMasterData();

  const defaultFormValues = {
    descripcionLabor: '',
    lote: '',
    jornadas: 0,
    jrnHa: 0,
  };
  
  const uniqueLotes = useMemo(() => {
    const lotesMap = new Map<string, {id: string, lote: string}>();
    lotes.forEach(lote => {
      if (!lotesMap.has(lote.lote)) {
        lotesMap.set(lote.lote, { id: lote.id, lote: lote.lote });
      }
    });
    return Array.from(lotesMap.values());
  }, [lotes]);

  useEffect(() => {
    setFbLoading(true);
    const unsubscribe = onSnapshot(collection(db, "presupuesto"), (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Presupuesto));
      const sortedData = recordsData.sort((a,b) => a.id.localeCompare(b.id));
      setData(sortedData);
      setFbLoading(false);
    }, (error) => {
      console.error("Error fetching data from Firestore: ", error);
      toast({ title: "Error de Conexión", description: "No se pudieron cargar los datos.", variant: "destructive" });
      setFbLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);

  const form = useForm<z.infer<typeof presupuestoSchema>>({
    resolver: zodResolver(presupuestoSchema),
    defaultValues: defaultFormValues,
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setSelectedFile(file);
  };
  
  const handleDownload = () => {
    const dataToExport = table.getFilteredRowModel().rows.map(row => row.original);
    const worksheetData = dataToExport.map(({ id, ...rest }) => ({
        "DESCRIPCION LABOR": rest.descripcionLabor,
        "LOTE": rest.lote,
        "JORNADAS": rest.jornadas,
        "JRN/HA": rest.jrnHa,
    }));
    const worksheet = xlsx.utils.json_to_sheet(worksheetData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Presupuesto");
    xlsx.writeFile(workbook, "Presupuesto.xlsx");
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
    if (data.length === 0) {
        toast({ title: "No hay registros", description: "La tabla ya está vacía." });
        return;
    }
    try {
        const collectionRef = collection(db, "presupuesto");
        const querySnapshot = await getDocs(query(collectionRef));
        
        if (querySnapshot.empty) {
            toast({ title: "No hay registros", description: "La base de datos ya está vacía." });
            return;
        }

        const batch = writeBatch(db);
        querySnapshot.forEach((docSnapshot) => {
            batch.delete(docSnapshot.ref);
        });
        
        await batch.commit();
        
        toast({ title: "Éxito", description: `Se eliminaron ${querySnapshot.size} registros.` });
    } catch (error) {
        console.error("Error deleting all documents: ", error);
        toast({ title: "Error", description: "No se pudieron eliminar todos los registros.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: z.infer<typeof presupuestoSchema>) => {
    try {
        const id = `${values.descripcionLabor}-${values.lote}`;
        const docRef = doc(db, "presupuesto", id);
        
        await setDoc(docRef, { ...values }, { merge: true });

        if (editingRecord) {
            if (editingRecord.id !== id) {
                await deleteDoc(doc(db, "presupuesto", editingRecord.id));
            }
            toast({ title: "Éxito", description: "Registro actualizado correctamente." });
            setEditingRecord(null);
        } else {
            toast({ title: "Éxito", description: "Registro creado correctamente." });
            setCreateDialogOpen(false);
        }
        form.reset(defaultFormValues);
    } catch (error) {
        toast({ title: "Error", description: "No se pudo guardar el registro.", variant: "destructive" });
    }
  };

  const columns = useMemo<ColumnDef<Presupuesto>[]>(
    () => [
      { accessorKey: "descripcionLabor", header: "DESCRIPCION LABOR", cell: ({ row }) => <div className="min-w-[250px]">{row.original.descripcionLabor}</div> },
      { accessorKey: "lote", header: "LOTE" },
      { accessorKey: "jornadas", header: "JORNADAS" },
      { accessorKey: "jrnHa", header: "JRN/HA" },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => {
                setEditingRecord(row.original);
                form.reset(row.original);
                setCreateDialogOpen(true); // Open as edit
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
    <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
        <FormField control={form.control} name="descripcionLabor" render={({ field }) => ( <FormItem><FormLabel>Descripción Labor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="lote" render={({ field }) => ( <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="jornadas" render={({ field }) => ( <FormItem><FormLabel>Jornadas</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="jrnHa" render={({ field }) => ( <FormItem><FormLabel>Jornadas/Ha</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
    </div>
  );
  
  const loading = fbLoading || masterLoading;

  const handleCreateClick = () => {
    setEditingRecord(null);
    form.reset(defaultFormValues);
    setCreateDialogOpen(true);
  };
  
  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <PageHeaderWithNav title="Maestro de Presupuesto" />
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <Input placeholder="Buscar por descripción..." value={(table.getColumn('descripcionLabor')?.getFilterValue() as string) ?? ''} onChange={(event) => table.getColumn('descripcionLabor')?.setFilterValue(event.target.value)} className="max-w-sm w-full h-9" />
              <div className="flex gap-2 w-full sm:w-auto">
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileSelect} />
                  <Tooltip><TooltipTrigger asChild><Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="h-9"><FileUp className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Cargar Excel</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button onClick={handleDownload} variant="outline" size="sm" disabled={table.getRowModel().rows.length === 0} className="h-9"><FileDown className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Descargar Excel</p></TooltipContent></Tooltip>
                  <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => { setCreateDialogOpen(isOpen); if (!isOpen) { form.reset(defaultFormValues); setEditingRecord(null); }}}>
                      <DialogTrigger asChild><Button size="sm" className="h-9" onClick={handleCreateClick}><PlusCircle className="mr-2 h-4 w-4" />Agregar</Button></DialogTrigger>
                      <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editingRecord ? 'Editar' : 'Agregar'} Presupuesto</DialogTitle></DialogHeader><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">{renderFormFields()}<DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter></form></Form></DialogContent>
                  </Dialog>
                   <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={data.length === 0} className="h-9">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Eliminar Todo</p></TooltipContent>
                        </Tooltip>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>Esta acción eliminará permanentemente {data.length} registros.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteAll}>Sí, eliminar todo</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
          </div>

          {selectedFile && ( <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50"><span className="flex-grow text-sm font-medium text-muted-foreground truncate">{selectedFile.name}</span><Button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} variant="ghost" size="icon"><X className="h-4 w-4" /></Button><Button size="sm" onClick={handleConfirmUpload} disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}{isUploading ? 'Subiendo...' : 'Confirmar'}</Button></div> )}

          <div className="rounded-md border"><Table><TableHeader>{table.getHeaderGroups().map((headerGroup) => ( <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => ( <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead> ))}</TableRow> ))}</TableHeader><TableBody>{loading ? ( <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow> ) : table.getRowModel().rows?.length ? ( table.getRowModel().rows.map((row) => ( <TableRow key={row.id}>{row.getVisibleCells().map((cell) => ( <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell> ))}</TableRow> )) ) : ( <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay datos.</TableCell></TableRow> )}</TableBody></Table></div>
          <div className="flex items-center justify-between gap-2 flex-wrap"><div className="flex items-center gap-2"><Select value={`${table.getState().pagination.pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}><SelectTrigger className="w-[70px] h-9"><SelectValue placeholder={table.getState().pagination.pageSize} /></SelectTrigger><SelectContent>{[10, 20, 50, 100].map((pageSize) => ( <SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem> ))}</SelectContent></Select><span className="text-sm text-muted-foreground">Fila {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}-{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "} de {table.getFilteredRowModel().rows.length}</span></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="h-9 w-9"><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-9 w-9"><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Página {table.getPageCount() > 0 ? table.getState().pagination.pageIndex + 1 : 0} de {table.getPageCount()}</span><Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-9 w-9"><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="h-9 w-9"><ChevronsRight className="h-4 w-4" /></Button></div></div>
        </div>
      </div>
    </TooltipProvider>
  );
}
