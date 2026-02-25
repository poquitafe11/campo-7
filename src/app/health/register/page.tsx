"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Upload, FileDigit, Loader2, Sparkles, X, List, Save, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { isValid, parse } from 'date-fns';
import { digitizeHealthTableAction, renameAndMergeHeader } from "./actions";


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, writeBatch, doc, deleteDoc, updateDoc, getDocs } from "firebase/firestore";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";


interface ParsedRow {
  [key: string]: any;
  internalId?: string;
  id?: string;
}

const editRecordSchema = z.object({
  id: z.string(),
});

const editHeaderSchema = z.object({
    newName: z.string().min(1, "El nuevo nombre no puede estar vacío.").refine(name => !name.match(/[.#$[\]/]/), {
        message: "El nombre no puede contener los caracteres: . # $ [ ] /",
    }),
    mergeWith: z.string().optional(),
});


const parseCustomDate = (dateString: string): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;

    const normalizedDateString = dateString.toLowerCase().replace(/\./g, '').replace('setiembre', 'septiembre');
    const months: { [key: string]: number } = {
        ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
        jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11
    };
    
    const parts = normalizedDateString.split(/[\s\/-]/).filter(p => p);
    if (parts.length < 3) return null;

    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].substring(0, 3);
    const year = parseInt(parts.find(p => p.length === 4) || parts[2], 10);
    
    const month = months[monthStr];
    if (month === undefined || isNaN(day) || isNaN(year)) return null;

    const fullYear = year < 100 ? 2000 + year : year;

    const date = new Date(fullYear, month, day);
    return isValid(date) ? date : null;
};

const getBandColorClass = (band: string | undefined): string => {
    if (!band) return '';
    const lowerBand = band.toLowerCase();
    if (lowerBand.includes('roja')) return 'bg-red-200 text-red-900';
    if (lowerBand.includes('amarilla')) return 'bg-yellow-200 text-yellow-900';
    if (lowerBand.includes('azul')) return 'bg-blue-200 text-blue-900';
    if (lowerBand.includes('verde')) return 'bg-green-200 text-green-900';
    return '';
};


export default function RegisterHealthPage() {
  const { toast } = useToast();

  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [campaign, setCampaign] = useState('');
  const [stage, setStage] = useState('');
  
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [isHeaderSubmitting, setIsHeaderSubmitting] = useState(false);
  
  const editHeaderForm = useForm<z.infer<typeof editHeaderSchema>>({
    resolver: zodResolver(editHeaderSchema),
  });

  const form = useForm<z.infer<typeof editRecordSchema>>({
    resolver: zodResolver(editRecordSchema),
  });

  useEffect(() => {
    if (editingRecord) {
        const dynamicSchemaFields = Object.keys(editingRecord).reduce((acc, key) => {
            if (key !== 'id' && key !== 'internalId') {
                (acc as any)[key] = z.string().optional();
            }
            return acc;
        }, {} as Record<string, z.ZodType<any, any>>);
        
        const dynamicSchema = z.object({
            id: z.string(),
            ...dynamicSchemaFields
        });
        
        const resolver = zodResolver(dynamicSchema);
        form.reset(editingRecord, { resolver } as any);
    }
  }, [editingRecord, form]);

  useEffect(() => {
    const fetchRecords = async () => {
        try {
            const snapshot = await getDocs(collection(db, "registros-sanidad"));
            const records: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            records.sort((a: any, b: any) => {
                const dateA = parseCustomDate(a['fechaAplicacion'] || '');
                const dateB = parseCustomDate(b['fechaAplicacion'] || '');

                if (dateA && dateB) {
                    return dateB.getTime() - dateA.getTime();
                }
                if (dateA) return -1;
                if (dateB) return 1;
                return 0;
            });
            setSavedRecords(records);
        } catch(error) {
            console.error("Failed to fetch records", error);
            toast({
                title: "Error",
                description: "No se pudieron cargar los registros guardados. Comprueba tu conexión.",
                variant: "destructive",
            });
        }
    };
    fetchRecords();
  }, [toast]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImage(reader.result as string);
        setParsedData([]);
        setTableHeaders([]);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleDigitize = async () => {
    if (!sourceImage) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, seleccione una imagen primero." });
      return;
    }
    if (!campaign || !stage) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, selecciona Campaña y Etapa." });
      return;
    }
    
    setIsDigitizing(true);
    setParsedData([]);
    setTableHeaders([]);

    try {
      const result = await digitizeHealthTableAction({ photoDataUri: sourceImage });
      
      try {
        const data = JSON.parse(result.tableContent);
        if (Array.isArray(data) && data.length > 0) {
          const firstRow = data[0];
          const currentHeaders = Object.keys(firstRow);
          
          const finalHeaders = ['campaña', 'etapa', ...currentHeaders, 'acciones'];
          setTableHeaders([...new Set(finalHeaders)]);

          const enrichedData = data.map((row, index) => ({
            internalId: `preview-${index}`,
            campaña: campaign,
            etapa: stage,
            ...row
          }));
          setParsedData(enrichedData);
        } else {
             toast({
                variant: "destructive",
                title: "Formato Inesperado",
                description: "La IA no devolvió una tabla válida. Inténtalo de nuevo.",
             });
        }
      } catch {
        toast({
            variant: "destructive",
            title: "Error de Formato",
            description: "No se pudo interpretar la respuesta de la IA como una tabla.",
        });
      }

    } catch (error) {
      console.error("Error digitizing table: ", error);
      toast({
        variant: "destructive",
        title: "Error de Digitalización",
        description: "No se pudo extraer la tabla de la imagen.",
      });
    } finally {
      setIsDigitizing(false);
    }
  };
  
  const handleSave = async () => {
    if (parsedData.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "No hay datos para guardar." });
        return;
    }

    setIsSaving(true);
    try {
        const batch = writeBatch(db);
        parsedData.forEach(row => {
            const { internalId, ...rowData } = row;
            const docRef = doc(collection(db, "registros-sanidad"));
            batch.set(docRef, rowData);
        });
        await batch.commit();
        
        toast({ title: "Éxito", description: `${parsedData.length} registros han sido guardados.` });
        
        setSourceImage(null);
        setParsedData([]);
        setTableHeaders([]);
        setCampaign('');
        setStage('');
        if(fileInputRef.current) fileInputRef.current.value = '';

    } catch(error) {
        console.error("Error saving records: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los registros." });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeletePreview = (internalId: string) => {
    setParsedData(prev => prev.filter(row => row.internalId !== internalId));
  };
  
  const handleDeleteSaved = async (id: string) => {
    try {
        await deleteDoc(doc(db, "registros-sanidad", id));
        toast({ title: "Éxito", description: "Registro eliminado." });
        setSavedRecords(prev => prev.filter(r => r.id !== id));
    } catch (error) {
        console.error("Error deleting record:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };
  
  const onUpdateSubmit = async (values: any) => {
    if (!editingRecord) return;
    
    if (editingRecord.internalId) {
        setParsedData(prev => prev.map(row => 
            row.internalId === editingRecord.internalId ? { ...row, ...values, id: row.id } : row
        ));
        toast({ title: "Éxito", description: "Registro de la vista previa actualizado." });
    } else {
        try {
            const docRef = doc(db, "registros-sanidad", editingRecord.id);
            const { id, ...dataToUpdate } = values;
            await updateDoc(docRef, dataToUpdate);
            toast({ title: "Éxito", description: "Registro actualizado en la base de datos." });
            setSavedRecords(prev => prev.map(r => r.id === editingRecord.id ? { ...r, ...values } : r));
        } catch(error) {
            console.error("Error updating record:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el registro." });
        }
    }
    setEditingRecord(null);
  };
  
  const renderEditFormFields = () => {
    if (!editingRecord) return null;
    return Object.keys(editingRecord).map(key => {
        if (key === 'id' || key === 'internalId') return null;
        return (
            <FormField
                key={key}
                control={form.control}
                name={key as any}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{key.charAt(0).toUpperCase() + key.slice(1)}</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    });
  };

  const savedRecordsHeaders = useMemo(() => {
    const PREFERRED_ORDER = [
        'campaña',
        'etapa',
        'variedad',
        'turno',
        'fechaAplicacion',
        'lote',
        'cuartel',
        'tipoApp',
        'producto',
        'objetivo',
        'ingredienteActivo',
        'categoria',
        'prHoras',
        'banda',
    ];
    
    const headers = new Set<string>();
    savedRecords.forEach(record => { 
        Object.keys(record).forEach(key => { 
            if (key !== 'id') headers.add(key); 
        }); 
    });
    
    const headersArray = Array.from(headers);

    headersArray.sort((a, b) => {
        const indexA = PREFERRED_ORDER.indexOf(a);
        const indexB = PREFERRED_ORDER.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });
    
    return headersArray;
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
            <CardTitle className="flex items-center gap-2">
                <FileDigit className="h-6 w-6" />
                Digitalizar Tabla desde Imagen
            </CardTitle>
            <CardDescription>
                Sube una foto de una tabla, ajústala y la IA extraerá los datos por ti.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Seleccionar Imagen
                </Button>
                <div className="flex gap-4 w-full sm:w-auto">
                    <Select value={campaign} onValueChange={setCampaign}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Campaña" /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select>
                    <Select value={stage} onValueChange={setStage}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Etapa" /></SelectTrigger><SelectContent><SelectItem value="Habilitacion">Habilitacion</SelectItem><SelectItem value="Formacion">Formacion</SelectItem><SelectItem value="Produccion">Produccion</SelectItem></SelectContent></Select>
                </div>
            </div>
             <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

            {sourceImage && (
                <div className="space-y-4">
                     <p className="text-sm font-medium">Vista Previa:</p>
                    <img src={sourceImage} alt="Vista previa" className="rounded-md border max-w-sm" />
                    <div className="flex justify-center gap-4">
                        <Button onClick={handleDigitize} disabled={isDigitizing || !campaign || !stage}>
                            {isDigitizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            {isDigitizing ? "Digitalizando..." : "Digitalizar Tabla"}
                        </Button>
                        <Button variant="destructive" onClick={() => { setSourceImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}><X className="mr-2 h-4 w-4"/> Cancelar</Button>
                    </div>
                </div>
            )}
            
            {isDigitizing && ( <div className="space-y-2"><Label htmlFor="digitized-result">Resultado</Label><div className="space-y-2 rounded-md border p-4"><div className="h-4 bg-muted rounded-full w-3/4 animate-pulse"></div><div className="h-4 bg-muted rounded-full w-1/2 animate-pulse"></div><div className="h-4 bg-muted rounded-full w-5/6 animate-pulse"></div></div></div> )}
            
            {!isDigitizing && parsedData.length > 0 && (
                <div className="space-y-4">
                    <Label>Resultado (Vista Previa)</Label>
                    <div className="overflow-x-auto rounded-md border bg-muted/50 p-4">
                        <Table className="bg-background">
                            <TableHeader><TableRow>{tableHeaders.map(header => <TableHead key={header}>{header.charAt(0).toUpperCase() + header.slice(1)}</TableHead>)}</TableRow></TableHeader>
                            <TableBody>
                                {parsedData.map((row) => (
                                    <TableRow key={row.internalId}>
                                        {tableHeaders.map(header => (
                                            <TableCell key={`${row.internalId}-${header}`} className={cn('whitespace-nowrap', header.toLowerCase() === 'banda' && getBandColorClass(row[header]))}>
                                                {header === 'acciones' ? (
                                                  <div className="flex gap-2">
                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setEditingRecord({...row, id: row.internalId })}><Pencil className="h-4 w-4"/></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará la fila de la vista previa.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePreview(row.internalId!)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                  </div>
                                                ) : String(row[header] ?? '')}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isSaving ? 'Guardando...' : 'Guardar Datos'}
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><List className="h-6 w-6" />Base de Datos de Sanidad</CardTitle>
            <CardDescription>Historial de todos los registros de sanidad guardados.</CardDescription>
        </CardHeader>
        <CardContent>
            {savedRecords.length > 0 ? (
                <div className="overflow-x-auto rounded-md border bg-muted/50 p-4">
                    <Table className="bg-background">
                        <TableHeader>
                            <TableRow>
                                {savedRecordsHeaders.map(header => (
                                    <TableHead key={header} className="group">
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
                            {savedRecords.map(record => (
                                <TableRow key={record.id}>
                                    {savedRecordsHeaders.map(header => (
                                        <TableCell key={`${record.id}-${header}`} className={cn('whitespace-nowrap', header.toLowerCase() === 'banda' && getBandColorClass(record[header]))}>
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
                <CardDescription>Aún no se han registrado datos de sanidad.</CardDescription>
            )}
        </CardContent>
      </Card>
    </div>
    
    <Dialog open={!!editingRecord} onOpenChange={setEditingRecord}>
        <DialogContent>
            <DialogHeader><DialogTitle>Editar Registro de Sanidad</DialogTitle></DialogHeader>
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