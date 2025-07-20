
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
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
  CalendarIcon,
  FileUp,
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

const loteSchema = z.object({
    lote: z.string().min(1, "El lote es requerido"),
    cuartel: z.string().min(1, "El cuartel es requerido"),
    variedad: z.string().min(1, "La variedad es requerida"),
    ha: z.coerce.number().positive("Debe ser un número positivo"),
    densidad: z.coerce.number().positive("Debe ser un número positivo"),
    haProd: z.coerce.number().nonnegative("Debe ser un número no negativo"),
    plantasTotal: z.coerce.number().int().positive("Debe ser un entero positivo"),
    plantasProd: z.coerce.number().int().nonnegative("Debe ser un entero no negativo"),
    fechaCianamida: z.date({ required_error: "La fecha es requerida." }),
    campana: z.string().min(1, "La campaña es requerida"),
});

type Lote = z.infer<typeof loteSchema> & { id: string };

function normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/ó/g, 'o').replace(/ /g, '').replace(/\./g, '');
}

function parseExcelDate(excelDate: number | string): Date {
    if (typeof excelDate === 'string') {
        const date = new Date(excelDate);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    if (typeof excelDate === 'number') {
        return new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    }
    return new Date('invalid');
}


async function processAndUploadFile(file: File): Promise<{ count: number }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!e.target?.result) {
                    return reject(new Error('No se pudo leer el archivo.'));
                }
                const workbook = xlsx.read(e.target.result, { type: 'binary', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = xlsx.utils.sheet_to_json(worksheet, { raw: false });

                if (json.length === 0) {
                    return reject(new Error("El archivo está vacío o no tiene el formato correcto."));
                }
                
                const header = Object.keys(json[0]);
                const keyMap: { [key: string]: string } = {};

                Object.keys(loteSchema.shape).forEach(field => {
                    const normalizedField = normalizeKey(field);
                    const foundKey = header.find(h => normalizeKey(h) === normalizedField);
                    if (foundKey) {
                        keyMap[field] = foundKey;
                    }
                });

                if (!keyMap.lote || !keyMap.cuartel) {
                     return reject(new Error("El archivo debe contener columnas para 'Lote' y 'Cuartel'."));
                }
               
                const normalizedData = json.map(row => {
                    try {
                        const loteData: any = {};
                        for (const field in keyMap) {
                            const excelKey = keyMap[field];
                            let value = row[excelKey];
                            const fieldSchema = (loteSchema.shape as any)[field];

                            if (value === undefined || value === null || String(value).trim() === '') continue;

                            if (fieldSchema instanceof z.ZodDate) {
                                const parsedDate = parseExcelDate(value);
                                if (!isNaN(parsedDate.getTime())) {
                                    loteData[field] = parsedDate;
                                }
                            } else if (fieldSchema._def.typeName === "ZodNumber") {
                                const num = parseFloat(String(value).replace(',', '.'));
                                if (!isNaN(num)) {
                                   loteData[field] = num;
                                }
                            } else {
                                loteData[field] = String(value).trim();
                            }
                        }
                        
                        const validatedData = loteSchema.partial().parse(loteData);
                        
                        if (!validatedData.lote || !validatedData.cuartel) return null;
                        
                        const id = `${validatedData.lote}-${validatedData.cuartel}`;
                        
                        return { ...validatedData, id };

                    } catch(err) {
                        console.warn('Fila omitida por error de parseo:', row, err);
                        return null;
                    }
                }).filter(item => item && item.lote && item.cuartel);


                if (normalizedData.length === 0) {
                    return reject(new Error("No se encontraron datos válidos en el archivo. Verifique que todas las filas tengan Lote y Cuartel."));
                }

                const batch = writeBatch(db);
                normalizedData.forEach((lote) => {
                  if (lote && lote.id) {
                    const docRef = doc(db, 'maestro-lotes', lote.id);
                    batch.set(docRef, lote, { merge: true });
                  }
                });

                await batch.commit();
                resolve({ count: normalizedData.length });

            } catch (error: any) {
                console.error('Error processing or uploading file: ', error);
                reject(new Error(error.message || 'Hubo un error al procesar o subir el archivo.'));
            }
        };
        reader.onerror = (error) => {
            console.error('FileReader error: ', error);
            reject(new Error('Error al leer el archivo.'));
        };
        reader.readAsBinaryString(file);
    });
}


export default function MaestroLotesPage() {
  const [data, setData] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLote, setEditingLote] = useState<Lote | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "maestro-lotes"), (snapshot) => {
      const lotesData = snapshot.docs.map(doc => {
        const docData = doc.data();
        const fechaCianamida = docData.fechaCianamida?.toDate ? docData.fechaCianamida.toDate() : (docData.fechaCianamida ? parseISO(docData.fechaCianamida) : new Date());
        return { id: doc.id, ...docData, fechaCianamida } as Lote;
      });
      const sortedData = lotesData.sort((a, b) => {
          const loteA = parseInt(a.lote, 10);
          const loteB = parseInt(b.lote, 10);
          const cuartelA = parseInt(a.cuartel, 10);
          const cuartelB = parseInt(b.cuartel, 10);

          if (loteA !== loteB) {
            return loteA - loteB;
          }
          if (!isNaN(cuartelA) && !isNaN(cuartelB)) {
             return cuartelA - cuartelB;
          }
          return a.cuartel.localeCompare(b.cuartel);
      });
      setData(sortedData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching data from Firestore: ", error);
      toast({
          title: "Error de Conexión",
          description: "No se pudieron cargar los datos.",
          variant: "destructive"
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const form = useForm<z.infer<typeof loteSchema>>({
    resolver: zodResolver(loteSchema),
    defaultValues: {
        lote: "",
        cuartel: "",
        variedad: "",
        ha: 0,
        densidad: 0,
        haProd: 0,
        plantasTotal: 0,
        plantasProd: 0,
        campana: "",
        fechaCianamida: new Date(),
    }
  });
  
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

  const handleDelete = async (id: string) => {
    try {
        await deleteDoc(doc(db, "maestro-lotes", id));
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
      data.forEach((lote) => {
        const docRef = doc(db, "maestro-lotes", lote.id);
        batch.delete(docRef);
      });
      await batch.commit();
      toast({ title: "Éxito", description: `Se eliminaron ${data.length} registros.` });
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron eliminar todos los registros.", variant: "destructive" });
      console.error("Error deleting all documents: ", error);
    }
  };

  const handleEdit = (lote: Lote) => {
    setEditingLote(lote);
    form.reset({
        ...lote,
        fechaCianamida: lote.fechaCianamida instanceof Date ? lote.fechaCianamida : new Date(),
    });
  };

  const onSubmit = async (values: z.infer<typeof loteSchema>) => {
    try {
        const id = `${values.lote}-${values.cuartel}`;
        const docRef = doc(db, "maestro-lotes", id);
        
        await setDoc(docRef, values, { merge: true });

        if (editingLote) {
            // If the ID changed, delete the old document
            if (editingLote.id !== id) {
                await deleteDoc(doc(db, "maestro-lotes", editingLote.id));
            }
            toast({ title: "Éxito", description: "Registro actualizado correctamente." });
            setEditingLote(null);
        } else {
            toast({ title: "Éxito", description: "Registro creado correctamente." });
            setCreateDialogOpen(false);
        }
        form.reset({ ha: 0, densidad: 0, haProd: 0, plantasTotal: 0, plantasProd: 0, lote: '', cuartel: '', variedad: '', campana: '' });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo guardar el registro.", variant: "destructive" });
        console.error("Error saving document: ", error);
    }
  };

  const columns = useMemo<ColumnDef<Lote>[]>(
    () => [
      { accessorKey: "lote", header: "Lote" },
      { accessorKey: "cuartel", header: "Cuartel" },
      { accessorKey: "variedad", header: "Variedad" },
      { accessorKey: "ha", header: "Ha" },
      { accessorKey: "densidad", header: "Densidad" },
      { accessorKey: "haProd", header: "Ha Prod." },
      { accessorKey: "plantasTotal", header: "Plantas Total" },
      { accessorKey: "plantasProd", header: "Plantas Prod." },
      { 
        accessorKey: "fechaCianamida", 
        header: "Fecha Cianamida",
        cell: ({ row }) => {
            const date = row.getValue("fechaCianamida");
            return date instanceof Date && !isNaN(date.getTime()) ? format(date, 'dd/MM/yyyy') : "N/A";
        }
      },
      { accessorKey: "campana", header: "Campaña" },
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
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter }
  });

  const renderFormFields = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
        <FormField control={form.control} name="lote" render={({ field }) => ( <FormItem><FormLabel>Lote</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="cuartel" render={({ field }) => ( <FormItem><FormLabel>Cuartel</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="variedad" render={({ field }) => ( <FormItem><FormLabel>Variedad</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="ha" render={({ field }) => ( <FormItem><FormLabel>Ha</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="densidad" render={({ field }) => ( <FormItem><FormLabel>Densidad</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="haProd" render={({ field }) => ( <FormItem><FormLabel>Ha Prod.</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="plantasTotal" render={({ field }) => ( <FormItem><FormLabel>Plantas Total</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="plantasProd" render={({ field }) => ( <FormItem><FormLabel>Plantas Prod.</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="fechaCianamida" render={({ field }) => (
            <FormItem className="flex flex-col"><FormLabel>Fecha Cianamida</FormLabel>
                <Popover>
                    <PopoverTrigger asChild>
                        <FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                </Popover>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="campana" render={({ field }) => ( <FormItem><FormLabel>Campaña</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
    </div>
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Maestro de Lotes" />
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Input
                placeholder="Buscar en todos los campos..."
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm w-full"
            />
            <div className="flex gap-2 w-full sm:w-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileSelect}
                />
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-grow sm:flex-grow-0">
                  <FileUp className="mr-2 h-4 w-4" />
                  Seleccionar Excel
                </Button>
                <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => {
                    setCreateDialogOpen(isOpen);
                    if (!isOpen) form.reset({ ha: 0, densidad: 0, haProd: 0, plantasTotal: 0, plantasProd: 0, lote: '', cuartel: '', variedad: '', campana: '' });
                }}>
                    <DialogTrigger asChild>
                        <Button className="flex-grow sm:flex-grow-0">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Agregar Lote
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader><DialogTitle>Agregar Nuevo Registro</DialogTitle></DialogHeader>
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
                        <Button variant="destructive" disabled={data.length === 0} className="flex-grow sm:flex-grow-0">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar Todo
                        </Button>
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
            <Button onClick={handleConfirmUpload} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              {isUploading ? 'Subiendo...' : 'Confirmar y Subir'}
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
              {loading ? (
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
                <SelectTrigger className="w-[70px]"><SelectValue placeholder={table.getState().pagination.pageSize} /></SelectTrigger>
                <SelectContent>{[10, 20, 50, 100].map((pageSize) => ( <SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem> ))}</SelectContent>
              </Select>
               <span className="text-sm text-muted-foreground">
                Fila {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}-
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "}
                de {table.getFilteredRowModel().rows.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><ChevronsLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm">Página {table.getPageCount() > 0 ? table.getState().pagination.pageIndex + 1 : 0} de {table.getPageCount()}</span>
              <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}><ChevronsRight className="h-4 w-4" /></Button>
            </div>
        </div>

        <Dialog open={!!editingLote} onOpenChange={(open) => {
            if (!open) setEditingLote(null);
        }}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader><DialogTitle>Editar Registro</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {renderFormFields()}
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary" onClick={() => setEditingLote(null)}>Cancelar</Button></DialogClose>
                            <Button type="submit">Guardar Cambios</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

