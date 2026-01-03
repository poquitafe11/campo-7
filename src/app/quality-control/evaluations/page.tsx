
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Save, Loader2, RefreshCw, AlertTriangle, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

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
  const { setActions } = useHeaderActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cvReady, setCvReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Cargando motor de visión...");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setActions({ title: "Evaluación de Calibre" });
    return () => setActions({});
  }, [setActions]);

  const loadOpenCv = useCallback(() => {
    if (document.getElementById('opencv-script')) {
      if (window.cv) {
        setCvReady(true);
      }
      return;
    }
    const script = document.createElement('script');
    script.id = 'opencv-script';
    script.src = 'https://docs.opencv.org/4.9.0/opencv.js';
    script.async = true;
    script.onload = () => {
      // Check for cv being loaded
      const interval = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(interval);
          setCvReady(true);
        }
      }, 100);
    };
    script.onerror = () => {
       toast({ title: "Error", description: "No se pudo cargar la librería de visión.", variant: "destructive" });
    };
    document.body.appendChild(script);
  }, [toast]);

  useEffect(() => {
    loadOpenCv();
  }, [loadOpenCv]);

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
    if (!imgRef.current || !window.cv) {
      toast({ title: "Error", description: "La imagen o la librería de visión no están listas.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    setLoadingMessage("Analizando imagen...");
    setProgress(10);

    setTimeout(() => {
        let src;
        let gray;
        let blurred;
        let circles;
        let contours;
        let hierarchy;
        try {
            src = window.cv.imread(imgRef.current);
            gray = new window.cv.Mat();
            window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
            setProgress(20);

            blurred = new window.cv.Mat();
            window.cv.GaussianBlur(gray, blurred, new window.cv.Size(7, 7), 1.5, 1.5);
            setProgress(30);

            // --- Reference Coin Detection ---
            circles = new window.cv.Mat();
            window.cv.HoughCircles(blurred, circles, window.cv.HOUGH_GRADIENT, 1, 80, 80, 50, 20, 100);
            
            let pixelsPerMm = -1;
            let coinRadius = 0;
            if (circles.cols > 0) {
                // Assume largest circle is the coin
                let maxRadius = 0;
                for (let i = 0; i < circles.cols; ++i) {
                   if (circles.data32F[i * 3 + 2] > maxRadius) {
                       maxRadius = circles.data32F[i * 3 + 2];
                   }
                }
                if (maxRadius > 0) {
                    coinRadius = maxRadius;
                    pixelsPerMm = coinRadius * 2 / REFERENCE_DIAMETER_MM;
                }
            }

            if (pixelsPerMm === -1) {
                throw new Error("No se pudo encontrar la moneda de referencia. Asegúrate de que sea el objeto circular más grande y esté claramente visible.");
            }
            setProgress(50);
            setLoadingMessage("Detectando bayas...");

            // --- Berry Contour Detection ---
            const thresh = new window.cv.Mat();
            window.cv.threshold(blurred, thresh, 0, 255, window.cv.THRESH_BINARY_INV + window.cv.THRESH_OTSU);
            
            contours = new window.cv.MatVector();
            hierarchy = new window.cv.Mat();
            window.cv.findContours(thresh, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);
            
            const newMeasurements: Measurement[] = [];
            const minBerryArea = (coinRadius * coinRadius * Math.PI) * 0.1; // Min area relative to coin
            const maxBerryArea = (coinRadius * coinRadius * Math.PI) * 0.9; // Max area relative to coin

            for (let i = 0; i < contours.size(); ++i) {
                const cnt = contours.get(i);
                const area = window.cv.contourArea(cnt);
                
                if (area > minBerryArea && area < maxBerryArea) {
                    if (cnt.rows >= 5) {
                        const rotatedRect = window.cv.minAreaRect(cnt);
                        const diameter = Math.min(rotatedRect.size.width, rotatedRect.size.height) / pixelsPerMm;

                        newMeasurements.push({
                            id: newMeasurements.length,
                            diameter: parseFloat(diameter.toFixed(2)),
                        });
                    }
                }
                cnt.delete();
            }
            
            thresh.delete();
            setProgress(90);

            if (newMeasurements.length === 0) {
              toast({ title: "No se encontraron bayas", description: "No se detectaron objetos que parezcan bayas. Intenta con otra foto.", variant: "destructive" });
            } else {
              setMeasurements(newMeasurements);
              toast({ title: "Análisis Completo", description: `Se encontraron ${newMeasurements.length} bayas.` });
            }

        } catch (error: any) {
            console.error("OpenCV Error: ", error);
            toast({ title: "Error de Análisis", description: error.message || "No se pudo procesar la imagen.", variant: "destructive" });
        } finally {
            // Clean up memory
            src?.delete();
            gray?.delete();
            blurred?.delete();
            circles?.delete();
            contours?.delete();
            hierarchy?.delete();
            setIsProcessing(false);
            setProgress(0);
        }
    }, 500);
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
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>¡Requisito Importante!</AlertTitle>
        <AlertDescription>
         Para calibrar, la foto DEBE incluir una <strong>moneda de 1 Sol</strong>. Colócala plana sobre la misma superficie y asegúrate de que **no esté cubierta por tus dedos**.
        </AlertDescription>
      </Alert>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Cargar Imagen</CardTitle>
            <CardDescription>Usa la cámara o sube una foto que incluya las bayas y la moneda de 1 Sol bien visible.</CardDescription>
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
