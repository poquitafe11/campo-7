
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Upload, FileDigit, Loader2, Sparkles, X, List, Save } from "lucide-react";
import { format } from "date-fns";
import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { HealthData } from "@/lib/types";
import { digitizeHealthTable } from "@/ai/flows/digitize-health-table";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, writeBatch } from "firebase/firestore";

const DataItem = ({ label, value }: { label: string, value: any }) => (
    <p><strong className="font-medium text-foreground/80">{label}:</strong> {String(value)}</p>
);

type ParsedRow = { [key: string]: any };

export default function HealthPage() {
  const { toast } = useToast();

  const [digitizedText, setDigitizedText] = useState("");
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor, selecciona una imagen primero.",
      });
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
          setTableHeaders(Object.keys(data[0]));
          setParsedData(data);
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
            const docRef = doc(collection(db, "registros-sanidad"));
            batch.set(docRef, row);
        });
        await batch.commit();
        
        toast({ title: "Éxito", description: `${parsedData.length} registros han sido guardados.` });
        
        // Clear the state after saving
        setImagePreview(null);
        setDigitizedText('');
        setParsedData([]);
        setTableHeaders([]);
        if(fileInputRef.current) fileInputRef.current.value = '';

    } catch(error) {
        console.error("Error saving records: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los registros." });
    } finally {
        setIsSaving(false);
    }
  };
  
  const renderList = <T extends { id: string, [key: string]: any }>(items: T[]) => {
    if (items.length === 0) {
      return <CardDescription>Aún no se han registrado datos de sanidad.</CardDescription>;
    }
    return <div className="space-y-4 max-h-96 overflow-y-auto pr-2">{items.map(item => {
        const { id, ...rest } = item;
        return (
            <div key={id} className="p-3 border rounded-md bg-background/50 text-sm">
                {Object.entries(rest).map(([key, value]) => (
                    <DataItem key={key} label={key} value={value} />
                ))}
            </div>
        )
    })}</div>;
  };

  return (
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
        <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
        />
        <Button onClick={() => fileInputRef.current?.click()} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Seleccionar Imagen
        </Button>

        {imagePreview && (
            <div className="space-y-4">
            <div className="relative max-w-lg">
                <img src={imagePreview} alt="Vista previa de la tabla" className="rounded-md border" />
                <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => {
                        setImagePreview(null);
                        setDigitizedText('');
                        setParsedData([]);
                        setTableHeaders([]);
                        if(fileInputRef.current) fileInputRef.current.value = '';
                    }}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <Button onClick={handleDigitize} disabled={isDigitizing}>
                {isDigitizing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isDigitizing ? "Digitalizando..." : "Digitalizar Tabla"}
            </Button>
            </div>
        )}

        {isDigitizing && (
            <div className="space-y-2">
                <Label htmlFor="digitized-result">Resultado</Label>
                <div className="space-y-2 rounded-md border p-4">
                    <div className="h-4 bg-muted rounded-full w-3/4 animate-pulse"></div>
                    <div className="h-4 bg-muted rounded-full w-1/2 animate-pulse"></div>
                    <div className="h-4 bg-muted rounded-full w-5/6 animate-pulse"></div>
                </div>
            </div>
        )}

        {!isDigitizing && parsedData.length > 0 && (
            <div className="space-y-4">
                <Label>Resultado</Label>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {tableHeaders.map(header => <TableHead key={header}>{header}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {parsedData.map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                    {tableHeaders.map(header => <TableCell key={`${rowIndex}-${header}`}>{String(row[header])}</TableCell>)}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Save className="mr-2 h-4 w-4" /> )}
                    {isSaving ? 'Guardando...' : 'Guardar Datos'}
                </Button>
            </div>
        )}
        
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <List className="h-6 w-6" />
                Resumen de Aplicaciones Sanitarias
            </CardTitle>
            <CardDescription>
                Historial de todos los registros de sanidad guardados.
            </CardDescription>
        </CardHeader>
        <CardContent>
            {renderList(savedRecords)}
        </CardContent>
      </Card>
    </div>
  );
}
