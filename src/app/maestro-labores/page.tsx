
"use client";

import React, { useState, useMemo, useRef } from "react";
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


type Labor = {
  codigo: string;
  descripcion: string;
};

const laborSchema = z.object({
    codigo: z.string().min(1, "El código es requerido"),
    descripcion: z.string().min(1, "La descripción es requerida"),
});

export default function MaestroLaboresPage() {
  const [data, setData] = useState<Labor[]>([]);
  const [editingLabor, setEditingLabor] = useState<Labor | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof laborSchema>>({
    resolver: zodResolver(laborSchema),
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = xlsx.read(e.target?.result, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = xlsx.utils.sheet_to_json(worksheet);

          const requiredKeys = ["codigo", "descripcion"];
          const normalizedData = json.map(row => {
              const normalizedRow: Partial<Labor> = {};
              for (const key in row) {
                  const normalizedKey = key.trim().toLowerCase();
                  if(requiredKeys.includes(normalizedKey)) {
                      normalizedRow[normalizedKey as keyof Labor] = String(row[key]);
                  }
              }
              return normalizedRow as Labor;
          }).filter(row => row.codigo && row.descripcion);

          if (normalizedData.length === 0) {
              throw new Error("El archivo no contiene las columnas 'Codigo' y 'Descripcion' o está vacío.");
          }

          setData(prev => [...prev, ...normalizedData]);
          toast({ title: "Éxito", description: "Archivo cargado correctamente." });
        } catch (error) {
            console.error("Error processing file: ", error);
            toast({ variant: "destructive", title: "Error", description: (error as Error).message });
        }
      };
      reader.readAsBinaryString(file);
      event.target.value = ''; // Reset file input
    }
  };

  const handleDownload = () => {
    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Maestro de Labores");
    xlsx.writeFile(workbook, "MaestroDeLabores.xlsx");
  };

  const handleDelete = (codigo: string) => {
    setData(data.filter((labor) => labor.codigo !== codigo));
    toast({ title: "Éxito", description: "Labor eliminada correctamente." });
  };
  
  const handleEdit = (labor: Labor) => {
    setEditingLabor(labor);
    form.reset({
        codigo: labor.codigo,
        descripcion: labor.descripcion,
    });
  };

  const onEditSubmit = (values: z.infer<typeof laborSchema>) => {
    if (editingLabor) {
        setData(data.map(l => (l.codigo === editingLabor.codigo ? values : l)));
        setEditingLabor(null);
        toast({ title: "Éxito", description: "Labor actualizada correctamente." });
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
                    Esta acción no se puede deshacer. Esto eliminará permanentemente la labor.
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
    [data]
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <Input
            placeholder="Buscar por descripción..."
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" /> Cargar Excel
            </Button>
            <Button onClick={handleDownload} variant="outline" disabled={data.length === 0}>
              <FileDown className="mr-2 h-4 w-4" /> Descargar
            </Button>
          </div>
        </div>

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
              {table.getRowModel().rows?.length ? (
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
        
        <div className="flex items-center justify-between gap-2">
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
                Fila {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
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
                Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
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
