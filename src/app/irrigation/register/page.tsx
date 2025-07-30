
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Upload, FileDigit, Loader2, Sparkles, X, List, Save, Pencil, Trash2, Crop, FileDown, Filter } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import ReactCrop, { type Crop as CropType, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import * as xlsx from "xlsx";
import { format, parseISO, isValid } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { digitizeIrrigationTable } from "@/ai/flows/digitize-irrigation-table";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, writeBatch, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type ParsedRow = { [key: string]: any; internalId?: string; id?: string };

const editRecordSchema = z.object({
  id: z.string(),
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

export default function RegisterIrrigationPage() {
  const { toast } = useToast();

  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  
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
    const unsubscribe = onSnapshot(collection(db, "registros-riego"), (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const sortedRecords = records.sort((a, b) => {
        const dateA = a.Fecha ? (a.Fecha.toDate ? a.Fecha.toDate() : (isValid(parseISO(a.Fecha)) ? parseISO(a.Fecha) : 0)) : 0;
        const dateB = b.Fecha ? (b.Fecha.toDate ? b.Fecha.toDate() : (isValid(parseISO(b.Fecha)) ? parseISO(b.Fecha) : 0)) : 0;
        
        if (dateA && dateB) {
            return dateB.getTime() - dateA.getTime();
        }
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
        setTableHeaders([]);
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
    setTableHeaders([]);

    try {
      const result = await digitizeIrrigationTable({ photoDataUri: croppedImage });
      
      try {
        const data = JSON.parse(result.tableContent);
        if (Array.isArray(data) && data.length > 0) {
          const enrichedData = data.map((row, index) => ({
            internalId: `preview-${index}`,
            'Campaña': campaign,
            'Etapa': stage,
            ...row
          }));
          setParsedData(enrichedData);

          const firstRow = enrichedData[0];
          const allHeaders = Object.keys(firstRow);
          
          const PREFERRED_ORDER = ['Fundo', 'Dia', 'Fecha', 'Campaña', 'Etapa', 'Bomba N°', 'Sector', 'Lote', 'De', 'Hasta', 'Total Horas', 'Observaciones', 'eT', 'Kc', 'Total m3/Dia', 'Ha.', 'm3/Ha /Hora', 'Lps Ideal', 'Lps adicion al 10%', 'Tiosulfato de Calcio (Lts)', 'Tiosulfato de Magnesio (Lts)', 'N', 'P2O5', 'K', 'Ca', 'Mg', 'Zn', 'Mn'];
          
          const sortedHeaders = allHeaders
            .filter(h => h !== 'internalId')
            .sort((a, b) => {
              const indexA = PREFERRED_ORDER.indexOf(a);
              const indexB = PREFERRED_ORDER.indexOf(b);
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              return a.localeCompare(b);
            });

          setTableHeaders([...sortedHeaders, 'Acciones']);

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
            const docRef = doc(collection(db, "registros-riego"));
            batch.set(docRef, rowData);
        });
        await batch.commit();
        
        toast({ title: "Éxito", description: `${parsedData.length} registros han sido guardados.` });
        
        setSourceImage(null);
        setCroppedImage(null);
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
        await deleteDoc(doc(db, "registros-riego", id));
        toast({ title: "Éxito", description: "Registro eliminado." });
    } catch (error) {
        console.error("Error deleting record:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };
  
  const onUpdateSubmit = async (values: any) => {
    if (!editingRecord) return;
    
    const dataToUpdate = { ...values };
    delete dataToUpdate.id; // Remove id from the object to be updated

    if (editingRecord.internalId) {
        setParsedData(prev => prev.map(row => 
            row.internalId === editingRecord.internalId ? { ...row, ...values } : row
        ));
        toast({ title: "Éxito", description: "Registro de la vista previa actualizado." });
    } else {
        try {
            const docRef = doc(db, "registros-riego", editingRecord.id);
            await updateDoc(docRef, dataToUpdate);
            toast({ title: "Éxito", description: "Registro actualizado en la base de datos." });
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
                        <FormLabel>{key}</FormLabel>
                        <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    });
  };

  const savedRecordsHeaders = useMemo(() => {
    const PREFERRED_ORDER = ['Fundo', 'Dia', 'Fecha', 'Campaña', 'Etapa', 'Bomba N°', 'Sector', 'Lote', 'De', 'Hasta', 'Total Horas', 'Observaciones', 'eT', 'Kc', 'Total m3/Dia', 'Ha.', 'm3/Ha /Hora', 'Lps Ideal', 'Lps adicion al 10%', 'Tiosulfato de Calcio (Lts)', 'Tiosulfato de Magnesio (Lts)', 'N', 'P2O5', 'K', 'Ca', 'Mg', 'Zn', 'Mn'];
    const headers = new Set<string>();
    savedRecords.forEach(record => { Object.keys(record).forEach(key => { if (key !== 'id') headers.add(key); }); });
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
                    <div className="rounded-md border bg-muted/50 p-4 overflow-x-auto">
                        <Table className="bg-background">
                            <TableHeader><TableRow>{tableHeaders.map(header => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader>
                            <TableBody>
                                {parsedData.map((row) => (
                                    <TableRow key={row.internalId}>
                                        {tableHeaders.map(header => (
                                            <TableCell key={`${row.internalId}-${header}`} className='whitespace-nowrap'>
                                                {header === 'Acciones' ? (
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
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><List className="h-6 w-6" />Base de Datos de Riego</CardTitle>
                <CardDescription>Historial de todos los registros de riego guardados.</CardDescription>
              </div>
              <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredRecords.length === 0}><FileDown className="mr-2 h-4 w-4" />Descargar</Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Select value={filters.campana} onValueChange={(value) => setFilters(f => ({...f, campana: value === 'all' ? '' : value}))}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por Campaña" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todas las Campañas</SelectItem>{filterOptions.campanas.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                 <Select value={filters.lote} onValueChange={(value) => setFilters(f => ({...f, lote: value === 'all' ? '' : value}))}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por Lote" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos los Lotes</SelectItem>{filterOptions.lotes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                 <Select value={filters.etapa} onValueChange={(value) => setFilters(f => ({...f, etapa: value === 'all' ? '' : value}))}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por Etapa" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todas las Etapas</SelectItem>{filterOptions.etapas.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                 <Select value={filters.fecha} onValueChange={(value) => setFilters(f => ({...f, fecha: value === 'all' ? '' : value}))}>
                    <SelectTrigger><SelectValue placeholder="Filtrar por Fecha" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todas las Fechas</SelectItem>{filterOptions.fechas.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
            {filteredRecords.length > 0 ? (
                <div className="rounded-md border bg-muted/50 p-4 overflow-x-auto">
                    <Table className="bg-background">
                        <TableHeader>
                            <TableRow>
                                {savedRecordsHeaders.map(header => <TableHead key={header}>{header}</TableHead>)}
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.map(record => (
                                <TableRow key={record.id}>
                                    {savedRecordsHeaders.map(header => (
                                        <TableCell key={`${record.id}-${header}`} className='whitespace-nowrap'>
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
    </>
  );
}
