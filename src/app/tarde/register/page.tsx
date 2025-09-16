
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { CalendarIcon, Loader2, QrCode, User, Sprout, Wrench, Code, UserPlus, Trash2 } from 'lucide-react';
import type { LoteData } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WorkerMasterItem } from '@/lib/types';

// Schema for the main form
const afternoonRegisterSchema = z.object({
  date: z.date({ required_error: "La fecha es requerida." }),
  lote: z.string().min(1, "El lote es requerido."),
  code: z.string().min(1, "El código de labor es requerido."),
  labor: z.string().optional(),
  assistant: z.string().min(1, "El asistente es requerido."),
});

type AfternoonRegisterValues = z.infer<typeof afternoonRegisterSchema>;
type RegisteredPersonnel = { dni: string; name: string };

export default function RegisterTardePage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const { lotes, labors, asistentes, trabajadores, loading: masterLoading } = useMasterData();
  const { profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const [registeredPersonnel, setRegisteredPersonnel] = useState<RegisteredPersonnel[]>([]);
  const [manualDni, setManualDni] = useState('');

  const form = useForm<AfternoonRegisterValues>({
    resolver: zodResolver(afternoonRegisterSchema),
    defaultValues: {
      date: new Date(),
      lote: '',
      code: '',
      labor: '',
      assistant: profile?.dni || '',
    },
  });
  
  const codeValue = useWatch({ control: form.control, name: 'code' });


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
      if (!videoRef.current) return;
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
  
  useEffect(() => {
    if (codeValue) {
      const matchedLabor = labors.find(l => l.codigo === codeValue);
      form.setValue('labor', matchedLabor?.descripcion || '', { shouldValidate: true });
    } else {
      form.setValue('labor', '', { shouldValidate: true });
    }
  }, [codeValue, labors, form]);

  const uniqueLotes = useMemo(() => {
    const lotesMap = new Map<string, LoteData>();
    lotes.forEach(lote => {
      if (!lotesMap.has(lote.lote)) {
        lotesMap.set(lote.lote, lote);
      }
    });
    return Array.from(lotesMap.values());
  }, [lotes]);

  const handleManualAdd = (trabajadores: WorkerMasterItem[]) => {
    if (manualDni.length !== 8) {
        toast({ variant: 'destructive', title: 'DNI Inválido', description: 'El DNI debe tener 8 dígitos.' });
        return;
    }
    if (registeredPersonnel.some(p => p.dni === manualDni)) {
        toast({ variant: 'destructive', title: 'DNI Repetido', description: 'Esta persona ya ha sido registrada.' });
        setManualDni('');
        return;
    }

    const worker = trabajadores.find(t => t.dni === manualDni);
    if (!worker) {
        setRegisteredPersonnel(prev => [...prev, { dni: manualDni, name: 'Pendiente de actualizar' }]);
        toast({ title: 'Agregado (Pendiente)', description: `DNI ${manualDni} añadido. Actualice el maestro más tarde.` });
    } else {
        setRegisteredPersonnel(prev => [...prev, { dni: worker.dni, name: worker.name }]);
        toast({ title: 'Agregado', description: `${worker.name} ha sido añadido a la lista.` });
    }

    setManualDni('');
  };
  
  const handleRemovePersonnel = (dni: string) => {
    setRegisteredPersonnel(prev => prev.filter(p => p.dni !== dni));
  };


  function onSubmit(values: AfternoonRegisterValues) {
    console.log({
        ...values,
        personnel: registeredPersonnel
    });
    toast({ title: "Registro Guardado (Simulación)" });
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Registro de Asistencia Turno Tarde</CardTitle>
          <CardDescription>Complete los datos y escanee el QR del personal o ingrese el DNI manualmente.</CardDescription>
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
                     <FormItem><FormLabel className="flex items-center gap-2"><User className="h-4 w-4"/>Asistente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar asistente"}/></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {asistentes.map(a => <SelectItem key={a.id} value={a.id}>{a.assistantName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                     <FormMessage /></FormItem>
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
                 <div className="grid grid-cols-3 gap-2 items-end">
                    <FormField control={form.control} name="code" render={({ field }) => (
                        <FormItem className="col-span-1">
                            <FormLabel className="flex items-center gap-2"><Code className="h-4 w-4"/>Cód.</FormLabel>
                            <FormControl><Input {...field}/></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                     <FormField control={form.control} name="labor" render={({ field }) => (
                        <FormItem className="col-span-2">
                           <FormLabel className="flex items-center gap-2"><Wrench className="h-4 w-4"/>Labor</FormLabel>
                           <FormControl><Input {...field} readOnly disabled/></FormControl>
                           <FormMessage />
                        </FormItem>
                    )}/>
                 </div>
               </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Escanear QR o Ingresar DNI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <div className="flex flex-col sm:flex-row gap-2">
                <Input 
                    placeholder="Ingresar DNI manualmente"
                    value={manualDni}
                    onChange={(e) => setManualDni(e.target.value)}
                    maxLength={8}
                    className="h-10"
                />
                <Button type="button" onClick={() => handleManualAdd(trabajadores)} className="h-10 w-full sm:w-auto">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Agregar
                </Button>
            </div>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
            <CardTitle>Personal Registrado ({registeredPersonnel.length})</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md max-h-60 overflow-y-auto">
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>DNI</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead className="text-right"></TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {registeredPersonnel.length > 0 ? (
                          registeredPersonnel.map(p => (
                              <TableRow key={p.dni}>
                                  <TableCell className="font-medium">{p.dni}</TableCell>
                                  <TableCell>{p.name}</TableCell>
                                  <TableCell className="text-right">
                                      <Button variant="ghost" size="icon" onClick={() => handleRemovePersonnel(p.dni)}>
                                          <Trash2 className="h-4 w-4 text-destructive"/>
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))
                      ) : (
                         <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">
                                La lista de personal aparecerá aquí.
                            </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}

    