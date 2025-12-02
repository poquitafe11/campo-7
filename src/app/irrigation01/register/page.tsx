
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
import { collection, onSnapshot, writeBatch, doc, deleteDoc, updateDoc, setDoc, getDocs } from "firebase/firestore";
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

const headerGroups = {
  main: ['Fundo', 'Fecha', 'Dia', 'Campaña', 'Etapa', 'Bomba N°', 'Sector', 'Lote', 'De', 'Hasta', 'Total Horas', 'Observaciones'],
  metrics: ['ETo', 'Kc', 'Total m3Dia', 'Ha', 'm3Ha Hora', 'Lps Ideal', 'Lps adicional 10%'],
  units: ['N', 'P2O5', 'K', 'Ca', 'Mg', 'Zn', 'Mn', 'B', 'Fe', 'S']
};

const getHeaderGroupColor = (header: string) => {
  if (headerGroups.main.includes(header)) return 'bg-blue-100';
  if (headerGroups.metrics.includes(header)) return 'bg-green-100';
  if (headerGroups.units.includes(header)) return 'bg-gray-100';
  
  // Anything not in the fixed groups is considered an 'insumo'
  const allFixed = [...headerGroups.main, ...headerGroups.metrics, ...headerGroups.units];
  if (!allFixed.includes(header)) return 'bg-yellow-100';

  return '';
};


export default function RegisterIrrigation01Page() {
  const { toast } = useToast();
  const { setActions } = useHeaderActions();

  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  
  const form = useForm({
    resolver: zodResolver(editRecordSchema),
  });

  useEffect(() => {
    setActions({ title: "Registro de Riego 01" });
    return () => setActions({});
  }, [setActions]);
  
  useEffect(() => {
    if (editingRecord) {
        form.reset(editingRecord);
    }
  }, [editingRecord, form]);

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
        const extractedFundo = result.fundo;
        const extractedDate = result.fecha;
        const extractedDia = result.dia;
        const extractedEto = result.eto;
        
        if (Array.isArray(data) && data.length > 0) {
            const enrichedData = data.map((row, index) => ({
                internalId: `preview-${index}`,
                Campaña: campaign,
                Etapa: stage,
                Fundo: extractedFundo,
                Fecha: extractedDate,
                Dia: extractedDia,
                ETo: extractedEto,
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
            // Use a stable, predictable ID to allow for overwrites.
            // Using Campaña, Lote, Fecha, and now Sector for more uniqueness.
            const sector = rowData.Sector || 'General';
            const docId = `${rowData.Campaña}-${rowData.Lote}-${rowData.Fecha}-${sector}`.replace(/[\s/]/g, '-');
            const docRef = doc(db, "registros-riego-01", docId);
            batch.set(docRef, rowData, { merge: true }); // Use merge: true to update if exists
        });
        await batch.commit();
        
        toast({ title: "Éxito", description: `${parsedData.length} registros han sido guardados o actualizados.` });
        
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
  
  const onUpdateSubmit = async (values: { [key: string]: any }) => {
    if (!editingRecord) return;
  
    const { id, internalId, ...dataFromForm } = values;

    if (internalId) {
        setParsedData(prev => prev.map(r => r.internalId === internalId ? {...r, ...dataFromForm} : r));
        toast({ title: "Éxito", description: "Registro de la vista previa actualizado." });
    } else {
      try {
        const docRef = doc(db, 'registros-riego-01', id);
        await setDoc(docRef, dataFromForm, { merge: true });

        toast({
          title: 'Éxito',
          description: 'Registro actualizado en la base de datos.',
        });
        // This part is removed as we no longer keep savedRecords in this component.
        // The database component will show the live data.
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

  const previewHeaders = useMemo(() => getSortedHeaders(parsedData), [parsedData]);


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
    </>
  );
}

