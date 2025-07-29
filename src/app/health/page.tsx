
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Upload, FileDigit, Loader2, Sparkles, X, List } from "lucide-react";
import { format } from "date-fns";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { HealthData, HealthSchema } from "@/lib/types";
import { useAppData } from "@/context/AppDataContext";
import { digitizeHealthTable } from "@/ai/flows/digitize-health-table";
import { Label } from "@/components/ui/label";

const DataItem = ({ label, value }: { label: string, value: string | number | undefined }) => (
    <p><strong className="font-medium text-foreground/80">{label}:</strong> {value}</p>
);

export default function HealthPage() {
  const { state, dispatch } = useAppData();
  const { toast } = useToast();

  const [digitizedText, setDigitizedText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDigitizing, setIsDigitizing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof HealthSchema>>({
    resolver: zodResolver(HealthSchema),
    defaultValues: {
      disease: "",
      treatment: "",
      notes: "",
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setDigitizedText(""); // Reset text when new image is selected
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

    try {
      const result = await digitizeHealthTable({ photoDataUri: imagePreview });
      
      try {
        // Try to format the JSON for better readability
        const parsedJson = JSON.parse(result.tableContent);
        const formattedJson = JSON.stringify(parsedJson, null, 2);
        setDigitizedText(formattedJson);
      } catch {
        // If it's not valid JSON, just show the raw text
        setDigitizedText(result.tableContent);
      }

      toast({
        title: "¡Digitalización Completa!",
        description: "La tabla ha sido extraída de la imagen.",
      });
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
  
  const renderList = <T extends { id: string }>(items: T[], renderItem: (item: T) => React.ReactNode) => {
    if (items.length === 0) {
      return <CardDescription>Aún no se han registrado datos de sanidad.</CardDescription>;
    }
    return <div className="space-y-4">{items.map(item => <div key={item.id} className="p-3 border rounded-md bg-background/50">{renderItem(item)}</div>)}</div>;
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

        {(isDigitizing || digitizedText) && (
            <div className="space-y-2">
                <Label htmlFor="digitized-result">Resultado</Label>
                {isDigitizing ? (
                <div className="space-y-2 rounded-md border p-4">
                    <div className="h-4 bg-muted rounded-full w-3/4 animate-pulse"></div>
                    <div className="h-4 bg-muted rounded-full w-1/2 animate-pulse"></div>
                    <div className="h-4 bg-muted rounded-full w-5/6 animate-pulse"></div>
                </div>
                ) : (
                    <Textarea
                    id="digitized-result"
                    value={digitizedText}
                    readOnly
                    rows={10}
                    placeholder="Los datos de la tabla aparecerán aquí."
                    />
                )}
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
            {renderList(state.health, (item: HealthData) => (
                <>
                <DataItem label="Fecha" value={format(item.observationDate, 'PPP')} />
                <DataItem label="Problema" value={item.disease} />
                <DataItem label="Tratamiento" value={item.treatment} />
                {item.notes && <DataItem label="Notas" value={item.notes} />}
                </>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
