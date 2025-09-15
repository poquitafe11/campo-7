"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useMasterData } from '@/context/MasterDataContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2, QrCode, UserPlus, Sprout, Wrench } from 'lucide-react';
import type { LoteData } from '@/lib/types';


// Schema for the main form
const afternoonRegisterSchema = z.object({
  date: z.date({ required_error: "La fecha es requerida." }),
  lote: z.string().min(1, "El lote es requerido."),
  labor: z.string().min(1, "La labor es requerida."),
  assistant: z.string().min(1, "El asistente es requerido."),
});

type AfternoonRegisterValues = z.infer<typeof afternoonRegisterSchema>;

export default function RegisterTardePage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const { lotes, labors, asistentes, loading: masterLoading } = useMasterData();
  const { profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const form = useForm<AfternoonRegisterValues>({
    resolver: zodResolver(afternoonRegisterSchema),
    defaultValues: {
      date: new Date(),
      lote: '',
      labor: '',
      assistant: profile?.dni || '',
    },
  });

  useEffect(() => {
    setActions({ title: "Registro de Tarde" });
    return () => setActions({});
  }, [setActions]);
  
  useEffect(() => {
    if(profile?.dni) {
        form.setValue('assistant', profile.dni);
    }
  }, [profile, form]);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Acceso a Cámara Denegado',
          description: 'Por favor, habilite los permisos de cámara en su navegador.',
        });
      }
    };

    getCameraPermission();
  }, [toast]);

  const uniqueLotes = useMemo(() => {
    const lotesMap = new Map<string, LoteData>();
    lotes.forEach(lote => {
      if (!lotesMap.has(lote.lote)) {
        lotesMap.set(lote.lote, lote);
      }
    });
    return Array.from(lotesMap.values());
  }, [lotes]);

  function onSubmit(values: AfternoonRegisterValues) {
    console.log(values);
    toast({ title: "Registro Guardado (Simulación)" });
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Registro de Asistencia Turno Tarde</CardTitle>
          <CardDescription>Complete los datos y escanee el QR del personal.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Fecha</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                    <FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="assistant" render={({ field }) => (
                     <FormItem><FormLabel>Asistente</FormLabel><FormControl>
                        <Input {...field} readOnly disabled value={profile?.nombre || field.value}/>
                     </FormControl><FormMessage /></FormItem>
                )}/>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="lote" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><Sprout className="h-4 w-4"/>Lote</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}><FormControl>
                            <SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar lote"} /></SelectTrigger>
                        </FormControl><SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent></Select>
                    <FormMessage /></FormItem>
                )}/>
                 <FormField control={form.control} name="labor" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2"><Wrench className="h-4 w-4"/>Labor</FormLabel>
                         <Select onValueChange={field.onChange} value={field.value}><FormControl>
                            <SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar labor"} /></SelectTrigger>
                         </FormControl><SelectContent>{labors.map(l => <SelectItem key={l.codigo} value={l.descripcion}>{l.descripcion}</SelectItem>)}</SelectContent></Select>
                    <FormMessage /></FormItem>
                )}/>
               </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Escanear QR del Personal</CardTitle>
        </CardHeader>
        <CardContent>
             <div className="relative aspect-video bg-muted rounded-md overflow-hidden border">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                {hasCameraPermission === false && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Alert variant="destructive" className="w-4/5">
                            <AlertTitle>Cámara no disponible</AlertTitle>
                            <AlertDescription>
                                Habilite los permisos de la cámara para escanear.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
                 {hasCameraPermission === null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                 )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/5 h-3/5 border-4 border-dashed border-white/50 rounded-lg"></div>
                </div>
            </div>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
            <CardTitle>Personal Registrado</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-center h-24 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">La lista de personal aparecerá aquí.</p>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}
