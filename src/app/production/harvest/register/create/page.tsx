
"use client";

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

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
import { CalendarIcon, Save, Loader2, QrCode, LayoutGrid, Grape, Truck, BarChart3, TrendingUp, FilePlus2, Database, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoteData } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';


const harvestRegisterSchema = z.object({
  fecha: z.date({ required_error: 'La fecha es requerida.' }),
  responsable: z.string().min(1, 'El responsable es requerido.'),
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

function HarvestMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <LayoutGrid className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>Registro de Cosecha</DropdownMenuLabel>
        <DropdownMenuGroup>
          <Link href="/production/harvest/register/create">
            <DropdownMenuItem><FilePlus2 className="mr-2 h-4 w-4" />Registro de Cosecha</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/database">
            <DropdownMenuItem><Database className="mr-2 h-4 w-4" />Base de Datos</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/summary">
            <DropdownMenuItem><BarChart3 className="mr-2 h-4 w-4" />Resumen</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/projection">
            <DropdownMenuItem><TrendingUp className="mr-2 h-4 w-4" />Proyección</DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Embarque</DropdownMenuLabel>
         <DropdownMenuGroup>
          <Link href="/production/harvest/shipment/register">
            <DropdownMenuItem><FilePlus2 className="mr-2 h-4 w-4" />Registro</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/shipment/database">
            <DropdownMenuItem><Database className="mr-2 h-4 w-4" />Base de Datos</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/shipment/summary">
            <DropdownMenuItem><BarChart3 className="mr-2 h-4 w-4" />Resumen</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/shipment/projection">
            <DropdownMenuItem><TrendingUp className="mr-2 h-4 w-4" />Proyección</DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
            <Link href="/production/harvest/groups">
                <DropdownMenuItem>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Gestión de Grupos</span>
                </DropdownMenuItem>
            </Link>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


export default function CreateHarvestRegisterPage() {
  const { setActions } = useHeaderActions();
  const { lotes, asistentes, loading: masterLoading } = useMasterData();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<HarvestRegisterValues>({
    resolver: zodResolver(harvestRegisterSchema),
    defaultValues: {
      fecha: new Date(),
      responsable: profile?.id || '',
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
    setActions({ 
        title: "Registro de Cosecha",
        right: <HarvestMenu />
    });
    return () => setActions({});
  }, [setActions]);

  useEffect(() => {
    if (profile?.id) {
      form.setValue('responsable', profile.id);
    }
  }, [profile, form]);
  
  const uniqueLotes = useMemo(() => {
    return [...new Map(lotes.map(l => [l.lote, l])).values()];
  }, [lotes]);

  const cuartelesOptions = useMemo(() => {
    if (!selectedLote) return [];
    return lotes.filter(l => l.lote === selectedLote);
  }, [selectedLote, lotes]);

  async function onSubmit(values: HarvestRegisterValues) {
    if (!profile?.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const docData = {
        ...values,
        createdBy: profile.email,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "registros-cosecha"), docData);
      toast({ title: "Registro Guardado", description: "Los datos de la cosecha han sido guardados correctamente." });
      form.reset({
        ...form.getValues(),
        guia: '',
        cuartel: '',
        grupo: 1,
        viaje: 1,
        jabas: 0,
        horaEmbarque: '',
        tractor: '',
        operador: '',
        obs: '',
      });
    } catch (error) {
      console.error("Error saving harvest record: ", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el registro." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Formulario de Registro</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <FormField control={form.control} name="fecha" render={({ field }) => (
                <FormItem><FormLabel>Fecha</FormLabel>
                  <Popover><PopoverTrigger asChild><FormControl>
                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "dd/MM/yyyy", { locale: es }) : <span>Selecciona una fecha</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                  <FormMessage />
                </FormItem>
              )}/>
              
              <FormField control={form.control} name="responsable" render={({ field }) => (
                <FormItem><FormLabel>Responsable</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar"} /></SelectTrigger></FormControl>
                        <SelectContent>{asistentes.map(a => <SelectItem key={a.id} value={a.id}>{a.assistantName}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}/>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="guia" render={({ field }) => (
                  <FormItem><FormLabel>Guía</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl><Input {...field} /></FormControl>
                      <Button type="button" variant="outline" size="icon"><QrCode/></Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="lote" render={({ field }) => (
                  <FormItem><FormLabel>Lote</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar"} /></SelectTrigger></FormControl>
                      <SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

               <FormField control={form.control} name="cuartel" render={({ field }) => (
                  <FormItem><FormLabel>Cuartel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedLote}>
                      <FormControl><SelectTrigger><SelectValue placeholder={!selectedLote ? "Seleccione un lote" : "Seleccionar"} /></SelectTrigger></FormControl>
                      <SelectContent>{cuartelesOptions.map(c => <SelectItem key={c.id} value={c.cuartel}>{c.cuartel}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
              )}/>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="grupo" render={({ field }) => (
                  <FormItem><FormLabel>N° Grupo</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                 <FormField control={form.control} name="viaje" render={({ field }) => (
                  <FormItem><FormLabel>N° Viaje</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="jabas" render={({ field }) => (
                  <FormItem><FormLabel>N° Jabas</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="horaEmbarque" render={({ field }) => (
                  <FormItem><FormLabel>Hora Embarque</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

               <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="tractor" render={({ field }) => (
                  <FormItem><FormLabel>N° Tractor</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="operador" render={({ field }) => (
                  <FormItem><FormLabel>Operador</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>

              <FormField control={form.control} name="obs" render={({ field }) => (
                  <FormItem><FormLabel>Obs.</FormLabel>
                    <FormControl><Textarea placeholder="Observaciones adicionales..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
              )}/>

              <div className="pt-4">
                 <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
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
