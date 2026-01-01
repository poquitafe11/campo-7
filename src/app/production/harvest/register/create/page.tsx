"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useMasterData } from '@/context/MasterDataContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, User, Notebook, Sprout, Blocks, Group, Plane, Box, Clock, Tractor, CircleUser, MessageSquare, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoteData } from '@/lib/types';


const harvestRegisterSchema = z.object({
  fecha: z.date({ required_error: 'La fecha es requerida.' }),
  responsable: z.string(),
  guia: z.string().min(1, 'El N° de guía es requerido.'),
  lote: z.string().min(1, 'El lote es requerido.'),
  cuartel: z.string().min(1, 'El cuartel es requerido.'),
  grupo: z.coerce.number().int().positive('Debe ser un número positivo.'),
  viaje: z.coerce.number().int().positive('Debe ser un número positivo.'),
  jabas: z.coerce.number().int().positive('Debe ser un número positivo.'),
  horaEmbarque: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato HH:MM requerido."),
  tractor: z.string().min(1, 'El N° de tractor es requerido.'),
  operador: z.string().min(1, 'El nombre del operador es requerido.'),
  obs: z.string().optional(),
});

type HarvestRegisterValues = z.infer<typeof harvestRegisterSchema>;


export default function CreateHarvestRegisterPage() {
  const { setActions } = useHeaderActions();
  const { lotes, loading: masterLoading } = useMasterData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<HarvestRegisterValues>({
    resolver: zodResolver(harvestRegisterSchema),
    defaultValues: {
      fecha: new Date(),
      responsable: profile?.nombre || '',
      guia: '',
      lote: '',
      cuartel: '',
      grupo: 1,
      viaje: 1,
      jabas: 0,
      horaEmbarque: '',
      tractor: '',
      operador: '',
      obs: '',
    },
  });

  const selectedLote = useWatch({ control: form.control, name: 'lote' });

  useEffect(() => {
    setActions({ title: "Registro de Cosecha" });
    return () => setActions({});
  }, [setActions]);

  useEffect(() => {
    if (profile?.nombre) {
      form.setValue('responsable', profile.nombre);
    }
  }, [profile, form]);
  
  const uniqueLotes = useMemo(() => {
    return [...new Map(lotes.map(l => [l.lote, l])).values()];
  }, [lotes]);

  const cuartelesOptions = useMemo(() => {
    if (!selectedLote) return [];
    return lotes.filter(l => l.lote === selectedLote);
  }, [selectedLote, lotes]);

  function onSubmit(values: HarvestRegisterValues) {
    console.log(values);
    setIsSubmitting(true);
    // TODO: Connect to save to database
    setTimeout(() => {
        toast({ title: "Registro Guardado (Simulación)", description: "Los datos de cosecha han sido registrados." });
        setIsSubmitting(false);
    }, 1500);
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Formulario de Registro de Cosecha</CardTitle>
          <CardDescription>Complete todos los campos para registrar una nueva entrada de cosecha.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField control={form.control} name="fecha" render={({ field }) => (
                <FormItem><FormLabel className="flex items-center gap-2"><CalendarIcon />Fecha</FormLabel>
                  <Popover><PopoverTrigger asChild><FormControl>
                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                  <FormMessage />
                </FormItem>
              )}/>
              
              <FormField control={form.control} name="responsable" render={({ field }) => (
                <FormItem><FormLabel className="flex items-center gap-2"><User />Responsable</FormLabel>
                  <FormControl><Input {...field} readOnly disabled /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="guia" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><Notebook />Guía</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="lote" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><Sprout />Lote</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar"} /></SelectTrigger></FormControl>
                      <SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

               <FormField control={form.control} name="cuartel" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><Blocks />Cuartel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedLote}>
                      <FormControl><SelectTrigger><SelectValue placeholder={!selectedLote ? "Seleccione un lote" : "Seleccionar"} /></SelectTrigger></FormControl>
                      <SelectContent>{cuartelesOptions.map(c => <SelectItem key={c.id} value={c.cuartel}>{c.cuartel}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
              )}/>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="grupo" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><Group />N° Grupo</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="viaje" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><Plane />N° Viaje</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="jabas" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><Box />N° Jabas</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="horaEmbarque" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><Clock />Hora de Embarque</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="tractor" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><Tractor />N° Tractor</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="operador" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><CircleUser />Operador</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <FormField control={form.control} name="obs" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2"><MessageSquare />Obs.</FormLabel>
                    <FormControl><Textarea placeholder="Observaciones adicionales..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )}/>

              <div className="flex justify-end pt-4">
                 <Button type="submit" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Registro
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
