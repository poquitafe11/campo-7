
"use client";

import React, { useState, useEffect } from "react";
import { Upload, FileDigit, Loader2, Sparkles, X, List, Save, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { digitizeHealthTable } from "@/ai/flows/digitize-health-table";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, writeBatch, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const DataItem = ({ label, value }: { label: string, value: any }) => (
    <p><strong className="font-medium text-foreground/80">{label}:</strong> {String(value)}</p>
);

type ParsedRow = { [key: string]: any; internalId?: string; id?: string };

const editRecordSchema = z.object({
  id: z.string(),
  Campaña: z.string(),
  Etapa: z.string(),
  Variedad: z.string(),
  Banda: z.string(),
  // Add other fields from your table that you want to be editable
});

export default function RegisterHealthPage() {
  const { toast } = useToast();

  const [digitizedText, setDigitizedText] = useState("");
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [campaign, setCampaign] = useState('');
  const [stage, setStage] = useState('');
  
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  const form = useForm<z.infer<typeof editRecordSchema>>({
    resolver: zodResolver(editRecordSchema),
  });

  useEffect(() => {
    if (editingRecord) {
        // Dynamically create a schema based on the editing record's keys
        const dynamicSchema = z.object({
            id: z.string(),
            ...Object.keys(editingRecord).reduce((acc, key) => {
                if (key !== 'id' && key !== 'internalId') {
                    (acc as any)[key] = z.string();
                }
                return acc;
            }, {})
        });
        
        const resolver = zodResolver(dynamicSchema);
        form.reset(editingRecord, { resolver } as any);
    }
  }, [editingRecord, form]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "registros-sanidad"), (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedRecords(records);
    });
    return () => unsubscribe();
  }, []);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setDigitizedText("");
        setParsedData([]);
        setTableHeaders([]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDigitize = async () => {
    if (!imagePreview) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, selecciona una imagen primero." });
      return;
    }
    if (!campaign || !stage) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, selecciona Campaña y Etapa." });
      return;
    }
    
    setIsDigitizing(true);
    setDigitizedText("");
    setParsedData([]);
    setTableHeaders([]);

    try {
      const result = await digitizeHealthTable({ photoDataUri: imagePreview });
      setDigitizedText(result.tableContent);
      
      try {
        const data = JSON.parse(result.tableContent);
        if (Array.isArray(data) && data.length > 0) {
          const firstRow = data[0];
          const currentHeaders = Object.keys(firstRow);
          
          const finalHeaders = ['Campaña', 'Etapa', ...currentHeaders, 'Acciones'];
          setTableHeaders([...new Set(finalHeaders)]);

          const enrichedData = data.map((row, index) => ({
            internalId: `preview-${index}`,
            'Campaña': campaign,
            'Etapa': stage,
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
        
        // Clear the state after saving
        setImagePreview(null);
        setDigitizedText('');
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
    } catch (error) {
        console.error("Error deleting record:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };
  
  const onUpdateSubmit = async (values: any) => {
    if (!editingRecord) return;
    
    // Check if we are editing a preview or a saved record
    if (editingRecord.internalId) {
        // Update preview data in state
        setParsedData(prev => prev.map(row => 
            row.internalId === editingRecord.internalId ? { ...row, ...values } : row
        ));
        toast({ title: "Éxito", description: "Registro de la vista previa actualizado." });
    } else {
        // Update saved record in Firestore
        try {
            const docRef = doc(db, "registros-sanidad", editingRecord.id);
            const { id, ...dataToUpdate } = values;
            await updateDoc(docRef, dataToUpdate);
            toast({ title: "Éxito", description: "Registro actualizado en la base de datos." });
        } catch(error) {
            console.error("Error updating record:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el registro." });
        }
    }
    setEditingRecord(null);
  };
  
  const renderList = (items: any[]) => {
    if (items.length === 0) {
      return <CardDescription>Aún no se han registrado datos de sanidad.</CardDescription>;
    }
    return (
        <div className="space-y-4 max-h-[40rem] overflow-y-auto pr-2">
            {items.map(item => {
                const { id, ...rest } = item;
                return (
                    <div key={id} className="p-4 border rounded-md bg-background/50 text-sm relative group">
                       <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setEditingRecord(item)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle><AlertDialogDescription>Esta acción es permanente.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSaved(id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                       </div>
                       <div className="space-y-1">
                          {Object.entries(rest).map(([key, value]) => (
                              <DataItem key={key} label={key} value={value} />
                          ))}
                       </div>
                    </div>
                )
            })}
        </div>
    );
  };
  
  const getBandColorClass = (bandValue: string) => {
    const lowerCaseBand = String(bandValue || '').toLowerCase();
    switch (lowerCaseBand) {
        case 'rojo': return 'bg-red-200 text-red-800';
        case 'amarillo': return 'bg-yellow-200 text-yellow-800';
        case 'verde': return 'bg-green-200 text-green-800';
        default: return '';
    }
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
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    });
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
                Sube una foto de una tabla y la IA extraerá los datos por ti.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Seleccionar Imagen
                </Button>
                <div className="flex gap-4 w-full sm:w-auto">
                    <Select value={campaign} onValueChange={setCampaign}>
                        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Campaña" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2025">2025</SelectItem>
                            <SelectItem value="2026">2026</SelectItem>
                            <SelectItem value="2027">2027</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={stage} onValueChange={setStage}>
                        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Habilitacion">Habilitacion</SelectItem>
                            <SelectItem value="Formacion">Formacion</SelectItem>
                            <SelectItem value="Produccion">Produccion</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            {imagePreview && (
                <div className="space-y-4">
                <div className="relative max-w-lg">
                    <img src={imagePreview} alt="Vista previa de la tabla" className="rounded-md border" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => { setImagePreview(null); setDigitizedText(''); setParsedData([]); setTableHeaders([]); if(fileInputRef.current) fileInputRef.current.value = ''; }}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
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
                                            <TableCell key={`${row.internalId}-${header}`} className={cn('whitespace-nowrap', header.toLowerCase() === 'banda' && getBandColorClass(row[header]))}>
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
                                                ) : String(row[header])}
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
        <CardContent>{renderList(savedRecords)}</CardContent>
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
    </>
  );
}

    