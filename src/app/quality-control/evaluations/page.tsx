
"use client";

import React, { useState, useRef, useMemo } from "react";
import { Camera, Ruler, Save, Loader2, RefreshCw, Hand, Trash2 } from "lucide-react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface Measurement {
  id: number;
  diameter: number;
  pixelDiameter: number;
}

// Simple calibration: pixels per mm. Adjust if necessary.
const PIXELS_PER_MM = 5;

export default function EvaluationsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setSourceImg(reader.result?.toString() || null);
        resetState();
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 20 }, 1, width, height),
      width,
      height
    );
    setCrop(initialCrop);
  };
  
  const handleAddMeasurementFromCrop = () => {
    if (!crop || !imgRef.current) {
        toast({ title: "Error", description: "No se ha seleccionado un área.", variant: "destructive" });
        return;
    }

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const pixelDiameter = Math.round(crop.width * scaleX);
    const diameterInMm = pixelDiameter / PIXELS_PER_MM;

    setMeasurements(prev => [
        ...prev,
        {
            id: prev.length > 0 ? Math.max(...prev.map(m => m.id)) + 1 : 1,
            diameter: diameterInMm,
            pixelDiameter: pixelDiameter
        }
    ]);
     toast({ title: "Medición Añadida", description: `Baya de ${diameterInMm.toFixed(2)} mm registrada.` });
  };
  
  const handleDeleteMeasurement = (id: number) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
  };


  const handleSaveMeasurements = async () => {
    if (measurements.length === 0) {
      toast({ title: "Sin datos", description: "No hay mediciones para guardar.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    // Placeholder for saving logic to Firestore
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Guardado", description: `${measurements.length} mediciones guardadas correctamente.` });
      resetState(true);
    }, 1000);
  };
  
  const resetState = (keepToast = false) => {
    if(!keepToast) setSourceImg(null);
    setMeasurements([]);
    setCrop(undefined);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const averageDiameter = useMemo(() => {
    if (measurements.length === 0) return 0;
    const total = measurements.reduce((sum, m) => sum + m.diameter, 0);
    return total / measurements.length;
  }, [measurements]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Evaluación Asistida de Calibre" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Cargar Imagen</CardTitle>
            <CardDescription>Usa la cámara o sube una foto. Luego, toca o arrastra sobre una baya para medirla.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} className="w-full">
              <Camera className="mr-2 h-4 w-4" /> Tomar o Subir Foto
            </Button>
            
            {sourceImg && (
              <div className="space-y-4">
                 <div className="relative">
                   <ReactCrop
                      crop={crop}
                      onChange={c => setCrop(c)}
                      aspect={1}
                      circularCrop
                    >
                      <img ref={imgRef} alt="Referencia" src={sourceImg} className="rounded-lg w-full" onLoad={onImageLoad} />
                    </ReactCrop>
                 </div>
                 <Button onClick={handleAddMeasurementFromCrop} className="w-full" disabled={!crop?.width}>
                    <Hand className="mr-2 h-4 w-4" /> Añadir Medición Seleccionada
                 </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Resultados de Medición</CardTitle>
            <CardDescription>Revisa las mediciones y guarda los resultados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {measurements.length > 0 ? (
              <div className="space-y-4">
                  <div className="max-h-60 overflow-y-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Diámetro (mm)</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {measurements.map(m => (
                            <TableRow key={m.id}>
                              <TableCell>{m.id}</TableCell>
                              <TableCell>{m.diameter.toFixed(2)}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteMeasurement(m.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  </div>
                  <Alert>
                    <Ruler className="h-4 w-4" />
                    <AlertTitle>Promedio de {measurements.length} bayas</AlertTitle>
                    <AlertDescription>{averageDiameter.toFixed(2)} mm</AlertDescription>
                  </Alert>
                <div className="flex flex-col gap-2 pt-4">
                    <Button onClick={handleSaveMeasurements} disabled={isSaving} className="w-full">
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                       Guardar {measurements.length} Mediciones
                    </Button>
                     <Button onClick={() => resetState()} variant="outline" className="w-full">
                      <RefreshCw className="mr-2 h-4 w-4" /> Nueva Evaluación
                    </Button>
                </div>
              </div>
            ) : (
                 <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground text-center">Añade mediciones para ver los resultados.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
