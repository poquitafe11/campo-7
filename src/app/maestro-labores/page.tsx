
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
  FileUp,
  FileDown,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  Loader2,
  CheckCircle,
  X
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
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


type Labor = {
  codigo: string;
  descripcion: string;
};

const laborSchema = z.object({
    codigo: z.string().min(1, "El código es requerido"),
    descripcion: z.string().min(1, "La descripción es requerida"),
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
        const codigoKey = header.find(key => normalizeKey(key).includes('codigo'));
        const descripcionKey = header.find(key => normalizeKey(key).includes('descripci'));

        if (!codigoKey || !descripcionKey) {
          return reject(new Error("El archivo debe contener una columna para 'Código' y otra para 'Descripción'."));
        }

        const normalizedData = json.map(row => {
          const codigo = String(row[codigoKey] || '').trim();
          const descripcion = String(row[descripcionKey] || '').trim();
          return { codigo, descripcion };
        }).filter(item => item.codigo && item.descripcion);


        if (normalizedData.length === 0) {
          return reject(new Error("No se encontraron datos válidos con código y descripción en el archivo."));
        }

        const batch = writeBatch(db);
        normalizedData.forEach((labor) => {
          const docRef = doc(db, 'maestro-labores', labor.codigo);
          batch.set(docRef, { descripcion: labor.descripcion }, { merge: true });
        });

        await batch.commit();
        resolve({ count: normalizedData.length });

      } catch (error: any) {
        console.error('Error processing or uploading file: ', error);
        reject(new Error(error.message || 'Hubo un error al procesar o subir el archivo. Revise la consola para más detalles.'));
      }
    };
    reader.onerror = (error) => {
      console.error('FileReader error: ', error);
      reject(new Error('Error al leer el archivo.'));
    };
    reader.readAsBinaryString(file);
  });
}


export default function MaestroLaboresPage() {
  const [data, setData] = useState<Labor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [editingLabor, setEditingLabor] = useState<Labor | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "maestro-labores"), (snapshot) => {
      const laboresData = snapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() })) as Labor[];
      const sortedData = laboresData.sort((a, b) => {
          const codeA = parseInt(a.codigo, 10);
          const codeB = parseInt(b.codigo, 10);
          if (!isNaN(codeA) && !isNaN(codeB)) {
            return codeA - codeB;
          }
          return a.codigo.localeCompare(b.codigo);
      });
      setData(sortedData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching data from Firestore: ", error);
      toast({
          title: "Error de Conexión",
          description: "No se pudieron cargar los datos. Revisa la consola y las reglas de seguridad de Firestore.",
          variant: "destructive"
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);


  const form = useForm<z.infer<typeof laborSchema>>({
    resolver: zodResolver(laborSchema),
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadError(null);
      setSelectedFile(file);
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const { count } = await processAndUploadFile(selectedFile);
      toast({ title: "Éxito", description: `${count} registros cargados/actualizados correctamente.` });
    } catch (error: any) {
      console.error("Upload failed:", error);
      setUploadError(error.message || "Ocurrió un error desconocido durante la carga.");
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = () => {
    const worksheet = xlsx.utils.json_to_sheet(data.map(d => ({ Codigo: d.codigo, Descripcion: d.descripcion })));
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Maestro de Labores");
    xlsx.writeFile(workbook, "MaestroDeLabores.xlsx");
  };

  const handleDelete = async (codigo: string) => {
    try {
        await deleteDoc(doc(db, "maestro-labores", codigo));
        toast({ title: "Éxito", description: "Labor eliminada correctamente." });
    } catch (error) {
        toast({ title: "Error", description: "No se pudo eliminar la labor.", variant: "destructive" });
        console.error("Error deleting document: ", error);
    }
  };
  
  const handleEdit = (labor: Labor) => {
    setEditingLabor(labor);
    form.reset({
        codigo: labor.codigo,
        descripcion: labor.descripcion,
    });
  };

  const onEditSubmit = async (values: z.infer<typeof laborSchema>) => {
    if (editingLabor) {
        try {
            const docRef = doc(db, "maestro-labores", editingLabor.codigo);
            await setDoc(docRef, { descripcion: values.descripcion }, { merge: true });
            setEditingLabor(null);
            toast({ title: "Éxito", description: "Labor actualizada correctamente." });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo actualizar la labor.", variant: "destructive" });
            console.error("Error updating document: ", error);
        }
    }
  };

  const columns = useMemo<ColumnDef<Labor>[]>(
    () => [
      { accessorKey: "codigo", header: "Código" },
      { accessorKey: "descripcion", header: "Descripción" },
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
                    Esta acción no se puede deshacer. Esto eliminará permanentemente la labor de la base de datos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(row.original.codigo)}>
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
    state: {
        globalFilter,
    }
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Maestro de Labores" />
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Input
            placeholder="Buscar por descripción..."
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
            <Button onClick={handleDownload} variant="outline" disabled={data.length === 0} className="flex-grow sm:flex-grow-0">
              <FileDown className="mr-2 h-4 w-4" /> 
              Descargar
            </Button>
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

        <AlertDialog open={!!uploadError} onOpenChange={() => setUploadError(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="text-destructive" />
                Error al Cargar el Archivo
              </AlertDialogTitle>
              <AlertDialogDescription>
                {uploadError}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setUploadError(null)}>Entendido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No hay datos. Sube un archivo de Excel para empezar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
               <span className="text-sm text-muted-foreground">
                Fila {table.getRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0}-
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}{" "}
                de {table.getFilteredRowModel().rows.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Página {table.getPageCount() > 0 ? table.getState().pagination.pageIndex + 1 : 0} de {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
               <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
        </div>

        <Dialog open={!!editingLabor} onOpenChange={(open) => !open && setEditingLabor(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Labor</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="codigo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="descripcion"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancelar</Button>
                            </DialogClose>
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
