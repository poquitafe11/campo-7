
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
import {
  FileUp,
  FileDown,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  CircleCheck,
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
  AlertDialogTrigger,
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
import { collection, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMasterData } from "@/context/MasterDataContext";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

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
                const json: any[] = xlsx.utils.sheet_to_json(worksheet, { raw: false });

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
  const { labors, loading: masterLoading } = useMasterData();
  const { setActions } = useHeaderActions();
  const [isUploading, setIsUploading] = useState(false);
  const [editingLabor, setEditingLabor] = useState<Labor | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setActions({ title: "Maestro de Labores" });
    return () => setActions({});
  }, [setActions]);

  const form = useForm<z.infer<typeof laborSchema>>({
    resolver: zodResolver(laborSchema),
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
      toast({ title: "Éxito", description: `${count} registros cargados/actualizados correctamente.` });
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast({ title: "Error al Cargar", description: error.message || "Ocurrió un error desconocido.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = () => {
    const worksheet = xlsx.utils.json_to_sheet(labors.map(d => ({ Codigo: d.codigo, Descripcion: d.descripcion })));
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
  
  const handleDeleteAll = async () => {
    if (labors.length === 0) {
      toast({
        title: "No hay nada que eliminar",
        description: "La base de datos ya está vacía.",
      });
      return;
    }
    try {
      const batch = writeBatch(db);
      labors.forEach((labor) => {
        const docRef = doc(db, "maestro-labores", labor.codigo);
        batch.delete(docRef);
      });
      await batch.commit();
      toast({
        title: "Éxito",
        description: `Se eliminaron ${labors.length} registros.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron eliminar todos los registros.",
        variant: "destructive",
      });
      console.error("Error deleting all documents: ", error);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: labors,
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
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Input
            placeholder="Buscar por descripción..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
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
                <p>Seleccionar Excel</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleDownload} variant="outline" size="sm" disabled={labors.length === 0} className="h-9">
                  <FileDown className="h-4 w-4" /> 
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Descargar Excel</p>
              </TooltipContent>
            </Tooltip>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={labors.length === 0} className="h-9">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Eliminar Todo</p>
                  </TooltipContent>
                </Tooltip>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Esto eliminará permanentemente los {labors.length} registros de la base de datos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll}>
                    Sí, eliminar todo
                  </AlertDialogAction>
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
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {masterLoading ? (
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
                <SelectTrigger className="w-[70px] h-9">
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
                className="h-9 w-9"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-9 w-9"
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
                className="h-9 w-9"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="h-9 w-9"
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
    </TooltipProvider>
  );
}
