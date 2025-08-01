
"use client";

import React, { useState, useRef, useMemo } from "react";
import { Camera, Ruler, Save, Loader2, RefreshCw, PlusCircle, BrainCircuit } from "lucide-react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { evaluateGrapeCaliber } from "@/ai/flows/evaluate-grape-caliber";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


interface Measurement {
  id: number;
  diameter: number;
  method: 'IA' | 'Manual';
}

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
  const [isManualAddOpen, setManualAddOpen] = useState(false);
  const [manualDiameter, setManualDiameter] = useState('');

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
    try {
      const result = await evaluateGrapeCaliber({ photoDataUri: croppedImgUrl });
      const aiMeasurements = result.measurements.map((diameter, index) => ({
        id: (measurements.length) + index + 1,
        diameter,
        method: 'IA' as const,
      }));
      setMeasurements(prev => [...prev, ...aiMeasurements]);
      toast({
        title: "Análisis IA Completo",
        description: `Se han medido ${aiMeasurements.length} bayas.`,
      });
    } catch (error) {
      console.error("Error evaluating grape caliber:", error);
      toast({
        variant: "destructive",
        title: "Error de Análisis",
        description: "No se pudo procesar la imagen. Inténtalo de nuevo.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddManualMeasurement = () => {
    const diameter = parseFloat(manualDiameter);
    if (!isNaN(diameter) && diameter > 0) {
        setMeasurements(prev => [
            ...prev,
            { id: prev.length + 1, diameter, method: 'Manual' as const }
        ]);
        setManualDiameter('');
        setManualAddOpen(false);
    } else {
        toast({
            title: "Valor Inválido",
            description: "Por favor, introduce un número de diámetro válido.",
            variant: "destructive"
        });
    }
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
            <CardTitle>1. Imagen de Referencia</CardTitle>
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
            <CardDescription>Usa la IA para analizar la imagen o añade mediciones manualmente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {croppedImgUrl ? (
                <div className="space-y-4">
                    <img alt="Cropped" src={croppedImgUrl} className="rounded-md w-full" />
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={handleProcessImage} disabled={isProcessing} className="flex-1">
                          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
                          {isProcessing ? 'Analizando...' : 'Análisis IA'}
                        </Button>
                        <Dialog open={isManualAddOpen} onOpenChange={setManualAddOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="flex-1">
                              <PlusCircle className="mr-2 h-4 w-4" /> Añadir Manual
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader><DialogTitle>Añadir Medición Manual</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                               <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="diameter" className="text-right">Diámetro (mm)</Label>
                                <Input id="diameter" type="number" value={manualDiameter} onChange={(e) => setManualDiameter(e.target.value)} className="col-span-3"/>
                               </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                                <Button onClick={handleAddManualMeasurement}>Añadir</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                    </div>
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
                    <div className="max-h-60 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Método</TableHead>
                              <TableHead className="text-right">Diámetro (mm)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {measurements.map(m => (
                              <TableRow key={m.id}>
                                <TableCell>{m.id}</TableCell>
                                <TableCell>{m.method}</TableCell>
                                <TableCell className="text-right">{m.diameter.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                    </div>
                    <Alert className="mt-4">
                      <AlertTitle>Promedio de {measurements.length} bayas</AlertTitle>
                      <AlertDescription>{averageDiameter.toFixed(2)} mm</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
                <div className="flex flex-col gap-2">
                    <Button onClick={handleSaveMeasurements} disabled={isSaving} className="w-full">
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                       Guardar {measurements.length} Mediciones
                    </Button>
                     <Button onClick={() => resetState()} variant="outline" className="w-full">
                      <RefreshCw className="mr-2 h-4 w-4" /> Nueva Evaluación
                    </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
