
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Loader2, Pencil, Trash2, FileDown, Filter, List } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as xlsx from "xlsx";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, deleteDoc, updateDoc, setDoc, getDocs } from "firebase/firestore";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { renameAndMergeHeader } from "./actions";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";


type ParsedRow = { [key: string]: any; internalId?: string; id?: string };


const editRecordSchema = z.object({
  id: z.string().optional(),
  internalId: z.string().optional(),
}).passthrough();

const editHeaderSchema = z.object({
    newName: z.string().min(1, "El nuevo nombre no puede estar vacío.").refine(name => !name.match(/[.#$[\]/]/), {
        message: "El nombre no puede contener los caracteres: . # $ [ ] /",
    }),
    mergeWith: z.string().optional(),
});


const headerGroups = {
  main: ['Fundo', 'Fecha', 'Dia', 'Campaña', 'Etapa', 'Bomba N°', 'Sector', 'Lote', 'De', 'Hasta', 'Total Horas', 'Observaciones'],
  metrics: ['ETo', 'Kc', 'Total m3Dia', 'Ha', 'm3Ha Hora', 'Lps Ideal', 'Lps adicional 10%'],
  units: ['N', 'P2O5', 'K', 'Ca', 'Mg', 'Zn', 'Mn', 'B', 'Fe', 'S']
};

const getHeaderGroupColor = (header: string) => {
  if (headerGroups.main.includes(header)) return 'bg-blue-100';
  if (headerGroups.metrics.includes(header)) return 'bg-green-100';
  if (headerGroups.units.includes(header)) return 'bg-gray-100';
  
  const allFixed = [...headerGroups.main, ...headerGroups.metrics, ...headerGroups.units];
  if (!allFixed.includes(header)) return 'bg-yellow-100';

  return '';
};

const parseSpanishDate = (dateString: string): Date => {
    if (!dateString) return new Date('invalid');
    const normalizedDateString = dateString.toLowerCase().replace('setiembre', 'septiembre');
    const months: { [key: string]: number } = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };
    const parts = normalizedDateString.split(' de ');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = months[parts[1]];
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
            return new Date(year, month, day);
        }
    }
    return new Date('invalid');
};


export default function IrrigationDatabasePage() {
  const { toast } = useToast();
  const { setActions } = useHeaderActions();

  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [filters, setFilters] = useState({ campana: '', lote: '', etapa: '', fecha: '' });
  
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [isHeaderSubmitting, setIsHeaderSubmitting] = useState(false);
  
  const editHeaderForm = useForm<z.infer<typeof editHeaderSchema>>({
    resolver: zodResolver(editHeaderSchema),
  });

  const form = useForm({
    resolver: zodResolver(editRecordSchema),
  });
  
  useEffect(() => {
    setActions({ title: "Base de Datos de Riego" });
    return () => setActions({});
  }, [setActions]);
  
  useEffect(() => {
    if (editingRecord) {
        form.reset(editingRecord);
    }
  }, [editingRecord, form]);

  useEffect(() => {
    const fetchRecords = async () => {
        try {
            const snapshot = await getDocs(collection(db, "registros-riego"));
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const sortedRecords = records.sort((a, b) => {
                const dateA = parseSpanishDate(a.Fecha);
                const dateB = parseSpanishDate(b.Fecha);
                
                if (dateA.toString() === 'Invalid Date') return 1;
                if (dateB.toString() === 'Invalid Date') return -1;

                return dateB.getTime() - dateA.getTime();
            });
            setSavedRecords(sortedRecords);
        } catch(error) {
            console.error("Failed to fetch records", error);
            toast({
                title: "Error",
                description: "No se pudieron cargar los registros. Comprueba tu conexión.",
                variant: "destructive",
            });
        }
    };
    fetchRecords();
  }, [toast]);

  useEffect(() => {
    const result = savedRecords.filter(record => {
        return (
            (filters.campana ? record['Campaña'] === filters.campana : true) &&
            (filters.lote ? record.Lote === filters.lote : true) &&
            (filters.etapa ? record['Etapa'] === filters.etapa : true) &&
            (filters.fecha ? record.Fecha === filters.fecha : true)
        );
    });
    setFilteredRecords(result);
  }, [filters, savedRecords]);

  const handleDeleteSaved = async (id: string) => {
    try {
        await deleteDoc(doc(db, "registros-riego", id));
        toast({ title: "Éxito", description: "Registro eliminado." });
        setSavedRecords(prev => prev.filter(r => r.id !== id));
    } catch (error) {
        console.error("Error deleting record:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };
  
  const onUpdateSubmit = async (values: { [key: string]: any }) => {
    if (!editingRecord) return;
  
    const { id, internalId, ...dataFromForm } = values;

    if (internalId) {
        // This logic is for preview data, which is no longer handled here.
        // It's safe to keep, but it won't be executed.
        toast({ title: "Éxito", description: "Registro de la vista previa actualizado." });
    } else {
      try {
        const docRef = doc(db, 'registros-riego', id);
        await setDoc(docRef, dataFromForm, { merge: true });

        toast({
          title: 'Éxito',
          description: 'Registro actualizado en la base de datos.',
        });
        setSavedRecords(prev => prev.map(r => r.id === id ? { ...r, ...dataFromForm } : r));
      } catch (error) {
        console.error('Error updating record:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `No se pudo actualizar el registro.`,
        });
      }
    }
    setEditingRecord(null);
  };
  
  const renderEditFormFields = () => {
    if (!editingRecord) return null;
    const fieldsToRender = Object.keys(editingRecord).filter(key => key !== 'id' && key !== 'internalId');
    
    return fieldsToRender.map(key => (
        <FormField
            key={key}
            control={form.control}
            name={key}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{key}</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    ));
  };
  
  const getSortedHeaders = (records: ParsedRow[]): string[] => {
    const allHeaders = new Set<string>();
    records.forEach(record => {
      Object.keys(record).forEach(key => {
        if (key !== 'id' && key !== 'internalId') {
          allHeaders.add(key);
        }
      });
    });

    const fixedHeaders1 = headerGroups.main.filter(h => allHeaders.has(h));
    const fixedHeaders2 = headerGroups.metrics.filter(h => allHeaders.has(h));
    const fixedHeaders4 = headerGroups.units.filter(h => allHeaders.has(h));
    
    const allFixedHeaders = new Set([...fixedHeaders1, ...fixedHeaders2, ...fixedHeaders4]);
    
    const dynamicHeaders = [...allHeaders].filter(h => !allFixedHeaders.has(h)).sort();

    return [...fixedHeaders1, ...fixedHeaders2, ...dynamicHeaders, ...fixedHeaders4];
  };

  const savedRecordsHeaders = useMemo(() => getSortedHeaders(filteredRecords), [filteredRecords]);

  const handleDownloadExcel = () => {
    const dataToExport = filteredRecords.map(record => {
      const { id, ...rest } = record;
      return rest;
    });
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "RegistrosRiego");
    xlsx.writeFile(workbook, "RegistrosRiego.xlsx");
    toast({ title: "Éxito", description: "La descarga ha comenzado." });
  };
  
  const filterOptions = useMemo(() => {
      const campanas = [...new Set(savedRecords.map(r => r['Campaña']))].filter(Boolean);
      const lotes = [...new Set(savedRecords.map(r => r.Lote))].filter(Boolean);
      const etapas = [...new Set(savedRecords.map(r => r['Etapa']))].filter(Boolean);
      const fechas = [...new Set(savedRecords.map(r => r.Fecha))].filter(Boolean);
      return { campanas, lotes, etapas, fechas };
  }, [savedRecords]);

  const handleEditHeader = (header: string) => {
    setEditingHeader(header);
    editHeaderForm.reset({ newName: header, mergeWith: '' });
  };

  const onEditHeaderSubmit = async (values: z.infer<typeof editHeaderSchema>) => {
    if (!editingHeader) return;
    setIsHeaderSubmitting(true);
    const { newName, mergeWith } = values;

    if(editingHeader === newName && !mergeWith) {
        setEditingHeader(null);
        setIsHeaderSubmitting(false);
        return;
    }

    const finalNewName = mergeWith || newName;

    const result = await renameAndMergeHeader({ oldHeader: editingHeader, newHeader: finalNewName });

    if(result.success) {
        toast({ title: "Éxito", description: `Se procesaron ${result.count} registros.` });
        setEditingHeader(null);
    } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
    }
    setIsHeaderSubmitting(false);
  };


  return (
    <>
    <div className="container mx-auto p-0 sm:p-2 lg:p-4 space-y-8">
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><List className="h-6 w-6" />Base de Datos de Riego</CardTitle>
                <CardDescription>Historial de todos los registros de riego guardados.</CardDescription>
              </div>
              <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredRecords.length === 0}><FileDown className="mr-2 h-4 w-4" />Descargar</Button>
                   <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Filter className="mr-2 h-4 w-4" />
                                Filtros
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                            <div className="grid gap-4">
                                <div className="space-y-2"><h4 className="font-medium leading-none">Filtros</h4></div>
                                <div className="grid gap-2">
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>Campaña</Label>
                                        <Select value={filters.campana} onValueChange={(value) => setFilters(f => ({...f, campana: value === 'all' ? '' : value}))}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.campanas.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>Lote</Label>
                                        <Select value={filters.lote} onValueChange={(value) => setFilters(f => ({...f, lote: value === 'all' ? '' : value}))}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>Etapa</Label>
                                        <Select value={filters.etapa} onValueChange={(value) => setFilters(f => ({...f, etapa: value === 'all' ? '' : value}))}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.etapas.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>Fecha</Label>
                                        <Select value={filters.fecha} onValueChange={(value) => setFilters(f => ({...f, fecha: value === 'all' ? '' : value}))}><SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.fechas.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
              </div>
            </div>
        </CardHeader>
        <CardContent>
            {filteredRecords.length > 0 ? (
                <div className="rounded-md border bg-muted/50 p-4 overflow-x-auto">
                    <Table className="bg-background">
                        <TableHeader>
                            <TableRow>
                                {savedRecordsHeaders.map(header => (
                                    <TableHead key={header} className={cn("group whitespace-nowrap", getHeaderGroupColor(header))}>
                                        <div className="flex items-center gap-1">
                                            {header}
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleEditHeader(header)}>
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableHead>
                                ))}
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.map(record => (
                                <TableRow key={record.id}>
                                    {savedRecordsHeaders.map(header => (
                                        <TableCell key={`${record.id}-${header}`} className={cn('whitespace-nowrap', getHeaderGroupColor(header))}>
                                            {String(record[header] ?? '')}
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setEditingRecord(record)}><Pencil className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle><AlertDialogDescription>Esta acción es permanente.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSaved(record.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <CardDescription>Aún no se han registrado datos de riego o no hay resultados para los filtros seleccionados.</CardDescription>
            )}
        </CardContent>
      </Card>
    </div>
    
    <Dialog open={!!editingRecord} onOpenChange={(isOpen) => { if(!isOpen) setEditingRecord(null) }}>
        <DialogContent>
            <DialogHeader><DialogTitle>Editar Registro de Riego</DialogTitle></DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onUpdateSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                    {renderEditFormFields()}
                    <DialogFooter className="pt-4 sticky bottom-0 bg-background">
                        <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                        <Button type="submit">Guardar Cambios</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    <Dialog open={!!editingHeader} onOpenChange={setEditingHeader}>
        <DialogContent>
            <DialogHeader><DialogTitle>Editar Encabezado</DialogTitle><DialogDescription>Renombra o fusiona la columna "{editingHeader}".</DialogDescription></DialogHeader>
            <Form {...editHeaderForm}>
                <form onSubmit={editHeaderForm.handleSubmit(onEditHeaderSubmit)} className="space-y-4">
                    <FormField
                        control={editHeaderForm.control}
                        name="newName"
                        render={({ field }) => (
                            <FormItem><FormLabel>Nuevo Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )}
                    />
                    <FormField
                        control={editHeaderForm.control}
                        name="mergeWith"
                        render={({ field }) => (
                            <FormItem><FormLabel>O fusionar con (opcional)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona un encabezado para fusionar" /></SelectTrigger></FormControl><SelectContent>{savedRecordsHeaders.filter(h => h !== editingHeader).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select><FormDescription>Los datos de "{editingHeader}" se añadirán a esta columna.</FormDescription><FormMessage /></FormItem>
                        )}
                    />
                    <DialogFooter className="pt-4">
                        <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={isHeaderSubmitting}>{isHeaderSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
