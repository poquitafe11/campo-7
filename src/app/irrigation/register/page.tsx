
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Upload, FileDigit, Loader2, Sparkles, X, List, Save, Pencil, Trash2, Crop, FileDown, Filter } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import ReactCrop, { type Crop as CropType, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import * as xlsx from "xlsx";
import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
 

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { digitizeIrrigationTable } from "@/ai/flows/digitize-irrigation-table";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, writeBatch, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { renameAndMergeHeader } from "./actions";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from 'lucide-react';


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

function getCroppedImg(image: HTMLImageElement, crop: CropType): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return Promise.reject(new Error('Canvas context not available'));
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    resolve(canvas.toDataURL('image/jpeg'));
  });
}

const parseSpanishDate = (dateString: string): Date => {
    if (!dateString) return new Date('invalid');
    const months: { [key: string]: number } = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };
    const parts = dateString.toLowerCase().split(' de ');
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

const headerGroups: { [key: string]: string[] } = {
  blue: ['Fecha', 'Campaña', 'Etapa', 'Bomba N°', 'Sector', 'Lote', 'De', 'Hasta', 'Total Horas', 'Observaciones'],
  green: ['Kc', 'ETo', 'ETc', 'Coef Uniformidad', 'Total m3Dia'],
  yellow: ['Ha', 'm3Ha Hora', 'Distancia', 'Entre', 'Goteros', 'Lps Ideal', 'Lps medido', 'Lps adicional 10%'],
  gray: ['Nitr Calcio (Kgr)', 'Molizan (Kgr)', 'Sulf Mag (Kgr)', 'Acido Nitrico (Ltr)', 'Acido Fosforico (Ltr)', 'N', 'P', 'K', 'Ca', 'Mg']
};

const getHeaderGroupColor = (header: string) => {
  if (headerGroups.blue.includes(header)) return 'bg-blue-100';
  if (headerGroups.green.includes(header)) return 'bg-green-100';
  if (headerGroups.yellow.includes(header)) return 'bg-yellow-100';
  if (headerGroups.gray.includes(header)) return 'bg-gray-100';
  return 'bg-background';
};

const headerOrder = [
  ...headerGroups.blue,
  ...headerGroups.green,
  ...headerGroups.yellow,
  ...headerGroups.gray
];


export default function RegisterIrrigationPage() {
  const { toast } = useToast();

  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [campaign, setCampaign] = useState('');
  const [stage, setStage] = useState('');
  
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // Cropping state
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<CropType>();
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);

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
    if (editingRecord) {
        form.reset(editingRecord);
    }
  }, [editingRecord, form]);


  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "registros-riego"), (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const sortedRecords = records.sort((a, b) => {
          const dateA = a.Fecha ? parseSpanishDate(a.Fecha) : new Date(0);
          const dateB = b.Fecha ? parseSpanishDate(b.Fecha) : new Date(0);
          
          if (isValid(dateA) && isValid(dateB)) {
              return dateB.getTime() - dateA.getTime();
          }
          if (isValid(dateA)) return -1;
          if (isValid(dateB)) return 1;
          return 0;
      });

      setSavedRecords(sortedRecords);
    });
    return () => unsubscribe();
  }, []);

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
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImage(reader.result as string);
        setCroppedImage(null);
        setParsedData([]);
        setCrop(undefined);
      };
      reader.readAsDataURL(file);
    }
  };
  
  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
      imgRef.current = e.currentTarget;
      const { width, height } = e.currentTarget;
      const initialCrop = centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, 16 / 9, width, height),
        width,
        height
      );
      setCrop(initialCrop);
  }

  const handleApplyCrop = async () => {
    if (imgRef.current && completedCrop) {
      const croppedDataUrl = await getCroppedImg(imgRef.current, completedCrop);
      setCroppedImage(croppedDataUrl);
      setSourceImage(null);
    }
  }

  const handleDigitize = async () => {
    if (!croppedImage) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, recorta y usa una imagen primero." });
      return;
    }
    if (!campaign || !stage) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, selecciona Campaña y Etapa." });
      return;
    }
    
    setIsDigitizing(true);
    setParsedData([]);

    try {
      const result = await digitizeIrrigationTable({ photoDataUri: croppedImage });
      
      try {
        const data = JSON.parse(result.tableContent);
        const extractedDate = result.fecha;
        
        if (Array.isArray(data) && data.length > 0) {
            const enrichedData = data.map((row, index) => ({
                internalId: `preview-${index}`,
                Fecha: extractedDate,
                Campaña: campaign,
                Etapa: stage,
                ...row,
            }));
            setParsedData(enrichedData);
        } else {
             toast({
                variant: "destructive",
                title: "Formato Inesperado",
                description: "La IA no devolvió una tabla válida. Inténtalo de nuevo.",
             });
        }
      } catch (e){
        console.error(e)
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
            // Generate a unique ID to prevent overwrites, or use a more specific ID if available
            const docId = `${rowData.Campaña}-${rowData.Lote}-${rowData.Fecha}-${Math.random()}`;
            const docRef = doc(db, "registros-riego", docId);
            batch.set(docRef, rowData);
        });
        await batch.commit();
        
        toast({ title: "Éxito", description: `${parsedData.length} registros han sido guardados.` });
        
        setSourceImage(null);
        setCroppedImage(null);
        setParsedData([]);
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
        await deleteDoc(doc(db, "registros-riego", id));
        toast({ title: "Éxito", description: "Registro eliminado." });
    } catch (error) {
        console.error("Error deleting record:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };
  
  const onUpdateSubmit = async (values: { [key: string]: any }) => {
    if (!editingRecord) return;
  
    const { id, internalId, ...dataFromForm } = values;

    if (internalId) {
        setParsedData(prev => prev.map(r => r.internalId === internalId ? {...r, ...dataFromForm} : r));
        toast({ title: "Éxito", description: "Registro de la vista previa actualizado." });
    } else {
      try {
        const docRef = doc(db, 'registros-riego', id);
        await setDoc(docRef, dataFromForm, { merge: true });

        toast({
          title: 'Éxito',
          description: 'Registro actualizado en la base de datos.',
        });
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

  const savedRecordsHeaders = useMemo(() => {
    const headers = new Set<string>();
    filteredRecords.forEach(record => { Object.keys(record).forEach(key => { if (key !== 'id') headers.add(key); }); });
    const headersArray = Array.from(headers);
    // Sort based on the predefined order
    headersArray.sort((a,b) => {
        const indexA = headerOrder.indexOf(a);
        const indexB = headerOrder.indexOf(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
    return headersArray;
  }, [filteredRecords]);

  const previewHeaders = useMemo(() => {
    if (parsedData.length === 0) return [];
    const headers = new Set<string>();
    parsedData.forEach(record => { Object.keys(record).forEach(key => { if (key !== 'internalId') headers.add(key); }); });
    const headersArray = Array.from(headers);
    headersArray.sort((a,b) => {
        const indexA = headerOrder.indexOf(a);
        const indexB = headerOrder.indexOf(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
    return headersArray;
  }, [parsedData]);

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

  const onEditHeaderSubmit = async (values: z.infer<typeof editHeaderSchema>>) => {
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
                Digitalizar Tabla de Riego desde Imagen
            </CardTitle>
            <CardDescription>
                Sube una foto de una tabla de riego, ajústala y la IA extraerá los datos por ti.
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
                    <div className="relative max-w-lg mx-auto">
                        <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}>
                            <img ref={imgRef} src={sourceImage} alt="Recortar imagen" onLoad={onImageLoad} style={{ maxHeight: '70vh' }}/>
                        </ReactCrop>
                    </div>
                    <div className="flex justify-center gap-4">
                        <Button onClick={handleApplyCrop} disabled={!completedCrop?.width || !completedCrop?.height}><Crop className="mr-2 h-4 w-4"/> Cortar y Usar Imagen</Button>
                        <Button variant="destructive" onClick={() => { setSourceImage(null); setCroppedImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}><X className="mr-2 h-4 w-4"/> Cancelar</Button>
                    </div>
                </div>
            )}
            
            {croppedImage && (
              <div className="space-y-4">
                <p className="text-sm font-medium">Vista Previa Recortada:</p>
                <img src={croppedImage} alt="Vista previa recortada" className="rounded-md border max-w-sm" />
                <Button onClick={handleDigitize} disabled={isDigitizing || !campaign || !stage}>
                    {isDigitizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {isDigitizing ? "Digitalizando..." : "Digitalizar Tabla"}
                </Button>
              </div>
            )}

            {isDigitizing && ( <div className="space-y-2"><Label htmlFor="digitized-result">Resultado</Label><div className="space-y-2 rounded-md border p-4"><div className="h-4 bg-muted rounded-full w-3/4 animate-pulse"></div><div className="h-4 bg-muted rounded-full w-1/2 animate-pulse"></div><div className="h-4 bg-muted rounded-full w-5/6 animate-pulse"></div></div></div> )}
            
            {!isDigitizing && parsedData.length > 0 && (
                <div className="space-y-4">
                    <Label>Resultado (Vista Previa)</Label>
                    <div className="overflow-x-auto rounded-md border bg-muted/50 p-4">
                        <Table className="bg-background">
                            <TableHeader><TableRow>{previewHeaders.map(header => <TableHead key={header} className={cn('whitespace-nowrap', getHeaderGroupColor(header))}>{header}</TableHead>)}<TableHead>Acciones</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {parsedData.map((row) => (
                                    <TableRow key={row.internalId}>
                                        {previewHeaders.map(header => (
                                            <TableCell key={`${row.internalId}-${header}`} className={cn('whitespace-nowrap', getHeaderGroupColor(header))}>
                                                {String(row[header] ?? '')}
                                            </TableCell>
                                        ))}
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setEditingRecord(row)}><Pencil className="h-4 w-4"/></Button>
                                                <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>¿Confirmar?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará la fila de la vista previa.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePreview(row.internalId!)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
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
