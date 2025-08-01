
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Camera, Ruler, Save, Loader2, RefreshCw, AlertTriangle, Coins, BrainCircuit, ScanLine } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

// Extend the Window interface to include cv
declare global {
  interface Window {
    cv: any;
  }
}

interface Measurement {
  id: number;
  diameter: number;
}

const REFERENCE_DIAMETER_MM = 25.5; // Diameter of a 1 Sol coin

export default function EvaluationsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cvReady, setCvReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Cargando motor de visión...");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const checkCv = () => {
      if (window.cv && window.cv.Mat) {
        setCvReady(true);
      } else {
        setTimeout(checkCv, 100);
      }
    };
    checkCv();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImg(event.target?.result?.toString() || null);
        resetState(true);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const processImage = () => {
    if (!imgRef.current || !canvasRef.current || !window.cv) {
      toast({ title: "Error", description: "La imagen o la librería de visión no están listas.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    setLoadingMessage("Analizando imagen...");
    setProgress(10);

    setTimeout(() => {
        try {
            const src = window.cv.imread(imgRef.current);
            const gray = new window.cv.Mat();
            window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
            setProgress(30);

            const blurred = new window.cv.Mat();
            window.cv.GaussianBlur(gray, blurred, new window.cv.Size(9, 9), 2, 2);
            setProgress(50);

            const circles = new window.cv.Mat();
            window.cv.HoughCircles(blurred, circles, window.cv.HOUGH_GRADIENT, 1, 40, 70, 40, 15, 60);

            let pixelsPerMm = -1;

            if (circles.cols > 0) {
                const referenceCircle = { x: 0, y: 0, radius: 0, distance: Infinity };
                for (let i = 0; i < circles.cols; ++i) {
                    const r = circles.data32F[i * 3 + 2];
                    if (r > referenceCircle.radius) {
                        referenceCircle.radius = r;
                    }
                }
                
                if (referenceCircle.radius > 0) {
                    pixelsPerMm = referenceCircle.radius * 2 / REFERENCE_DIAMETER_MM;
                }
            }

            if (pixelsPerMm === -1) {
                throw new Error("No se pudo encontrar la moneda de referencia. Asegúrate de que sea el objeto circular más grande y esté claramente visible.");
            }
            
            setProgress(70);

            const newMeasurements: Measurement[] = [];
            for (let i = 0; i < circles.cols; ++i) {
                const r = circles.data32F[i * 3 + 2];
                const diameter = (r * 2) / pixelsPerMm;

                if (diameter !== REFERENCE_DIAMETER_MM) {
                    newMeasurements.push({
                        id: i,
                        diameter: parseFloat(diameter.toFixed(2)),
                    });
                }
            }
            
            setMeasurements(newMeasurements);
            toast({ title: "Análisis Completo", description: `Se encontraron ${newMeasurements.length} bayas.` });
            
            src.delete(); gray.delete(); blurred.delete(); circles.delete();
            setProgress(100);

        } catch (error: any) {
            console.error("OpenCV Error: ", error);
            toast({ title: "Error de Análisis", description: error.message || "No se pudo procesar la imagen.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
            setProgress(0);
        }
    }, 500); // Small delay to allow UI to update
  };

  const resetState = (keepImage = false) => {
    if (!keepImage) setSourceImg(null);
    setMeasurements([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Evaluación de Calibre (Beta)" />

      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>¡Requisito Importante!</AlertTitle>
        <AlertDescription>
          Para calibrar, la foto DEBE incluir una <strong>moneda de 1 Sol</strong> como referencia. Colócala en la misma superficie que las bayas.
        </AlertDescription>
      </Alert>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Cargar Imagen de Bayas</CardTitle>
            <CardDescription>Usa la cámara o sube una foto que incluya las bayas y una moneda de 1 Sol.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} className="w-full" disabled={!cvReady || isProcessing}>
              {!cvReady ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              {cvReady ? 'Tomar o Subir Foto' : 'Cargando motor...'}
            </Button>
            
            {sourceImg && (
              <div className="space-y-4">
                <div className="relative border rounded-md overflow-hidden">
                  <img ref={imgRef} alt="Referencia" src={sourceImg} className="w-full h-auto" />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <Button onClick={processImage} className="w-full" disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                  Analizar Calibre
                </Button>
              </div>
            )}
            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">{loadingMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Resultados de Medición</CardTitle>
            <CardDescription>Revisa los calibres detectados automáticamente.</CardDescription>
          </CardHeader>
          <CardContent>
            {measurements.length > 0 ? (
              <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto border rounded-md">
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
                          <TableCell>#{m.id + 1}</TableCell>
                          <TableCell className="text-right">{m.diameter.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Alert>
                  <Ruler className="h-4 w-4" />
                  <AlertTitle>Promedio de {measurements.length} bayas</AlertTitle>
                  <AlertDescription>
                    {(measurements.reduce((sum, m) => sum + m.diameter, 0) / measurements.length).toFixed(2)} mm
                  </AlertDescription>
                </Alert>
                <div className="flex flex-col gap-2 pt-4">
                  <Button disabled className="w-full">
                    <Save className="mr-2 h-4 w-4" /> Guardar Resultados (Próximamente)
                  </Button>
                  <Button onClick={() => resetState()} variant="outline" className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" /> Nueva Evaluación
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground text-center">Esperando análisis...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
