
'use client';

import { useEffect, useMemo, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Tag,
  Wrench,
  Users,
  Sprout,
  FileOutput,
  FileInput,
  RotateCw,
  ClipboardList,
  Flame,
  Clock,
  Briefcase,
  Calculator,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ActivityRecordSchema, type LoteData } from '@/lib/types';
import { saveActivity } from './actions';
import { useAuth } from '@/hooks/useAuth';
import { useMasterData } from '@/context/MasterDataContext';

// Dynamically import the Calendar to ensure it's client-side only
const Calendar = dynamic(() => import('@/components/ui/calendar').then(mod => mod.Calendar), {
  ssr: false,
  loading: () => <div className="h-[290px] w-[240px] bg-muted rounded-md animate-pulse" />,
});


type ActivityFormValues = z.infer<typeof ActivityRecordSchema>;

const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">{children}</div>
);

export default function CreateActivityPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { labors, lotes, loading: masterLoading } = useMasterData();

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(ActivityRecordSchema),
    defaultValues: {
      registerDate: new Date(),
      campaign: '',
      stage: '',
      lote: '',
      code: '',
      labor: '',
      performance: 0,
      personnelCount: 1,
      workdayCount: 0,
      cost: 0,
      shift: '',
      minRange: 0,
      maxRange: 0,
      pass: 0,
      observations: '',
      createdBy: '',
    },
  });

  const codeValue = form.watch('code');
  
  const uniqueLotes = useMemo(() => {
    const lotesMap = new Map<string, LoteData>();
    lotes.forEach(lote => {
      if (!lotesMap.has(lote.lote)) {
        lotesMap.set(lote.lote, lote);
      }
    });
    return Array.from(lotesMap.values());
  }, [lotes]);

  useEffect(() => {
    if (codeValue) {
      const matchedLabor = labors.find(l => l.codigo === codeValue);
      form.setValue('labor', matchedLabor?.descripcion || '', { shouldValidate: true });
    } else {
      form.setValue('labor', '', { shouldValidate: true });
    }
  }, [codeValue, labors, form]);

  useEffect(() => {
    if (user?.email) {
      form.setValue('createdBy', user.email);
    }
  }, [user, form]);

  const onSubmit = (data: ActivityFormValues) => {
    startTransition(async () => {
        const result = await saveActivity(data);
        if (result.success) {
            toast({
                title: 'Éxito',
                description: 'Ficha de actividad guardada correctamente.',
            });
            // Explicitly reset all form fields to their initial empty/default state
            form.reset({
              registerDate: new Date(),
              campaign: '',
              stage: '',
              lote: '',
              code: '',
              labor: '',
              performance: 0,
              personnelCount: 1,
              workdayCount: 0,
              cost: 0,
              shift: '',
              minRange: 0,
              maxRange: 0,
              pass: 0,
              observations: '',
              createdBy: user?.email || '',
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Error al Guardar',
                description: result.message || 'No se pudo guardar la ficha.',
            });
        }
    });
  };

  return (
    <div className="flex flex-1 w-full flex-col bg-muted/20">
      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="rounded-lg border bg-background p-6 shadow-sm">
                <div className="space-y-6">
                   <FormField
                    control={form.control}
                    name="registerDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel><IconWrapper><CalendarIcon className="h-4 w-4" /> Fecha de Registro</IconWrapper></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={'outline'}
                                className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es} />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-6">
                    <FormField control={form.control} name="campaign" render={({ field }) => (
                      <FormItem>
                        <FormLabel><IconWrapper><Briefcase className="h-4 w-4" /> Campaña</IconWrapper></FormLabel>
                        <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="2025">2025</SelectItem>
                                  <SelectItem value="2026">2026</SelectItem>
                                  <SelectItem value="2027">2027</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="stage" render={({ field }) => (
                      <FormItem>
                        <FormLabel><IconWrapper><Flame className="h-4 w-4" /> Etapa</IconWrapper></FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="habilitacion">Habilitacion</SelectItem>
                                <SelectItem value="formacion">Formacion</SelectItem>
                                <SelectItem value="produccion">Produccion</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lote" render={({ field }) => (
                       <FormItem>
                         <FormLabel><IconWrapper><Sprout className="h-4 w-4" /> Lote</IconWrapper></FormLabel>
                         <FormControl>
                           <Select onValueChange={field.onChange} value={field.value}>
                               <SelectTrigger>
                                 <SelectValue placeholder={masterLoading ? "Cargando..." : "Selecciona"} />
                               </SelectTrigger>
                             <SelectContent>
                               {uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.lote}>{lote.lote}</SelectItem>)}
                             </SelectContent>
                           </Select>
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )} />
                  </div>

                  <div className="grid grid-cols-6 gap-6">
                      <FormField control={form.control} name="code" render={({ field }) => ( <FormItem className="col-span-2"> <FormLabel><IconWrapper><Tag className="h-4 w-4" /> Cód.</IconWrapper></FormLabel> <FormControl><Input placeholder="Ej: 1001" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={form.control} name="labor" render={({ field }) => ( <FormItem className="col-span-4"> <FormLabel><IconWrapper><Wrench className="h-4 w-4" /> Labor</IconWrapper></FormLabel> <FormControl><Input placeholder="Labor (auto-completado)" {...field} readOnly /></FormControl> <FormMessage /> </FormItem> )} />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6">
                      <FormField control={form.control} name="performance" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><TrendingUp className="h-4 w-4" /> Rendimiento</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={form.control} name="personnelCount" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Users className="h-4 w-4" /> # Personas</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="1" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={form.control} name="workdayCount" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><ClipboardList className="h-4 w-4" /> # Jornadas (JHU)</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <FormField control={form.control} name="cost" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Calculator className="h-4 w-4" /> S/ Costo (PEN)</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="shift" render={({ field }) => (
                       <FormItem>
                         <FormLabel><IconWrapper><Clock className="h-4 w-4" /> Turno</IconWrapper></FormLabel>
                         <FormControl>
                           <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="Mañana">Mañana</SelectItem>
                               <SelectItem value="Tarde">Tarde</SelectItem>
                             </SelectContent>
                           </Select>
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )} />
                    <FormField control={form.control} name="pass" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><RotateCw className="h-4 w-4" /> Pasada</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                      <FormField control={form.control} name="minRange" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><FileInput className="h-4 w-4" /> Min</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                      <FormField control={form.control} name="maxRange" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><FileOutput className="h-4 w-4"/> Max</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                  </div>
                  
                  <FormField control={form.control} name="observations" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Wrench className="h-4 w-4" /> Observaciones</IconWrapper></FormLabel> <FormControl><Textarea placeholder="Escribe aquí tus observaciones..." {...field} /></FormControl> <FormMessage /> </FormItem> )} />

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isPending || masterLoading}>
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar Ficha
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}
