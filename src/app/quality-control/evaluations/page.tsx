"use client";

import React, { useState, useRef, useMemo } from "react";
import { Camera, Ruler, Save, Loader2, RefreshCw, PlusCircle } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
}

export default function EvaluationsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
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
  
  const handleAddManualMeasurement = () => {
    const diameter = parseFloat(manualDiameter);
    if (!isNaN(diameter) && diameter > 0) {
        setMeasurements(prev => [
            ...prev,
            { id: prev.length + 1, diameter }
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
      <PageHeader title="Evaluación de Calibre Manual" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>1. Imagen de Referencia</CardTitle>
            <CardDescription>Usa la cámara o sube una foto para tener una referencia visual de las bayas que estás midiendo.</CardDescription>
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
                <img alt="Referencia" src={sourceImg} className="rounded-lg w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Registro de Mediciones</CardTitle>
            <CardDescription>Añade las mediciones manuales y guarda los resultados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={isManualAddOpen} onOpenChange={setManualAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Medición Manual
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
            
            {measurements.length > 0 ? (
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
                              <TableHead className="text-right">Diámetro (mm)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {measurements.map(m => (
                              <TableRow key={m.id}>
                                <TableCell>{m.id}</TableCell>
                                <TableCell className="text-right">{m.diameter.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                    </div>
                    <Alert className="mt-4">
                      <Ruler className="h-4 w-4" />
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
            ) : (
                 <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg mt-4">
                    <p className="text-muted-foreground text-center">Añade mediciones para ver los resultados.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
