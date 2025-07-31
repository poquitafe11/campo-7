
"use client";

import React, { useState, useRef } from "react";
import { Camera, Upload, Ruler, Save, Loader2, RefreshCw } from "lucide-react";
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
}

// Function to convert the cropped canvas area to a data URL
async function getCroppedImg(
  image: HTMLImageElement,
  crop: Crop
): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
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
  
  return canvas.toDataURL('image/jpeg');
}

export default function EvaluationsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [croppedImgUrl, setCroppedImgUrl] = useState<string | null>(null);

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setSourceImg(reader.result?.toString() || null));
      reader.readAsDataURL(e.target.files[0]);
      resetState();
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 16/9, width, height),
      width,
      height
    );
    setCrop(initialCrop);
  };
  
  const handleCrop = async () => {
    if (imgRef.current && completedCrop) {
      const url = await getCroppedImg(imgRef.current, completedCrop);
      setCroppedImgUrl(url);
    }
  };

  const handleProcessImage = async () => {
    if (!croppedImgUrl) {
      toast({ title: "Error", description: "Primero debes recortar una imagen.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    // Placeholder for CV logic.
    // In a real scenario, this would call a WASM module or a more complex client-side CV library.
    setTimeout(() => {
      const randomMeasurements = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        diameter: Math.random() * (25 - 15) + 15, // Random diameter between 15mm and 25mm
      }));
      setMeasurements(randomMeasurements);
      setIsProcessing(false);
      toast({ title: "Procesamiento Completo", description: "Se han medido 5 bayas (simulado)." });
    }, 1500);
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
    setCrop(undefined);
    setCompletedCrop(undefined);
    setCroppedImgUrl(null);
    setMeasurements([]);
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
      <PageHeader title="Evaluación de Calibre" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Capturar y Recortar Imagen</CardTitle>
            <CardDescription>Usa la cámara o sube una foto. Luego, recorta el área de interés.</CardDescription>
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
                <ReactCrop
                  crop={crop}
                  onChange={c => setCrop(c)}
                  onComplete={c => setCompletedCrop(c)}
                  aspect={16 / 9}
                >
                  <img ref={imgRef} alt="Crop me" src={sourceImg} onLoad={onImageLoad} style={{ maxHeight: '50vh' }} />
                </ReactCrop>
                <Button onClick={handleCrop} disabled={!completedCrop?.width}>Recortar Imagen</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Procesar y Guardar</CardTitle>
            <CardDescription>La app analizará la imagen recortada para medir el calibre de las bayas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {croppedImgUrl ? (
                <div className="space-y-4">
                    <img alt="Cropped" src={croppedImgUrl} className="rounded-md w-full" />
                    <Button onClick={handleProcessImage} disabled={isProcessing} className="w-full">
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ruler className="mr-2 h-4 w-4" />}
                      {isProcessing ? 'Analizando...' : 'Analizar Calibre'}
                    </Button>
                </div>
            ) : (
                <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground text-center">Aquí aparecerá la imagen recortada.</p>
                </div>
            )}
            
            {measurements.length > 0 && (
              <div className="space-y-4 pt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Resultados de Medición</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Baya #</TableHead>
                          <TableHead className="text-right">Diámetro (mm)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {measurements.map(m => (
                          <TableRow key={m.id}>
                            <TableCell>Baya {m.id}</TableCell>
                            <TableCell className="text-right">{m.diameter.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Alert className="mt-4">
                      <AlertTitle>Promedio</AlertTitle>
                      <AlertDescription>{averageDiameter.toFixed(2)} mm</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
                <Button onClick={handleSaveMeasurements} disabled={isSaving} className="w-full">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                   Guardar Mediciones
                </Button>
                 <Button onClick={() => resetState()} variant="outline" className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" /> Nueva Evaluación
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
