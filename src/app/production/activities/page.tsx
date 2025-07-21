
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ActivityRecordSchema, type Labor, type LoteData } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

type ActivityFormValues = z.infer<typeof ActivityRecordSchema>;

const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-muted-foreground">{children}</div>
);

export default function ActivitiesPage() {
  const { toast } = useToast();
  const [labors, setLabors] = useState<Labor[]>([]);
  const [lotes, setLotes] = useState<LoteData[]>([]);

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
    const loadMasterData = async () => {
      try {
        const [laborsSnapshot, lotesSnapshot] = await Promise.all([
          getDocs(collection(db, 'maestro-labores')),
          getDocs(collection(db, 'maestro-lotes')),
        ]);
        const laborsData = laborsSnapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() } as Labor));
        setLabors(laborsData);
        const lotesData = lotesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoteData));
        setLotes(lotesData);
      } catch (error) {
        console.error('Error loading master data:', error);
        toast({
          variant: 'destructive',
          title: 'Error de Carga',
          description: 'No se pudieron cargar los datos maestros.',
        });
      }
    };
    loadMasterData();
  }, [toast]);

  useEffect(() => {
    if (codeValue) {
      const matchedLabor = labors.find(l => l.codigo === codeValue);
      form.setValue('labor', matchedLabor?.descripcion || 'Labor (auto-completado)', { shouldValidate: true });
    } else {
      form.setValue('labor', 'Labor (auto-completado)', { shouldValidate: true });
    }
  }, [codeValue, labors, form]);

  const onSubmit = (data: ActivityFormValues) => {
    console.log(data);
    toast({
      title: 'Ficha Registrada (Simulación)',
      description: <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4"><code className="text-white">{JSON.stringify(data, null, 2)}</code></pre>,
    });
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/20">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/production">
              <ArrowLeft />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <h1 className="text-xl font-semibold font-headline">Nueva Ficha de Registro</h1>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="rounded-lg border bg-background p-6 shadow-sm">
                <div className="space-y-6">
                  
                  <FormField
                    control={form.control}
                    name="registerDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4" /> Fecha de Registro
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={'outline'}
                                className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                              >
                                {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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

                  <FormField 
                    control={form.control} 
                    name="campaign" 
                    render={({ field }) => ( 
                      <FormItem> 
                        <FormLabel className="flex items-center gap-2 text-sm text-muted-foreground"><Briefcase className="h-4 w-4" /> Campaña</FormLabel> 
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="2024-2025">2024-2025</SelectItem>
                            <SelectItem value="2025-2026">2025-2026</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage /> 
                      </FormItem> 
                    )} 
                  />
                  
                  <FormField 
                    control={form.control} 
                    name="stage" 
                    render={({ field }) => ( 
                      <FormItem> 
                        <FormLabel className="flex items-center gap-2 text-sm text-muted-foreground"><Flame className="h-4 w-4" /> Etapa</FormLabel> 
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="poda">Poda</SelectItem>
                            <SelectItem value="floracion">Floración</SelectItem>
                            <SelectItem value="cosecha">Cosecha</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage /> 
                      </FormItem> 
                    )} 
                  />

                  <FormField
                    control={form.control}
                    name="lote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-sm text-muted-foreground"><Sprout className="h-4 w-4" /> Lote</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              {uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.lote}>{lote.lote}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField 
                    control={form.control} 
                    name="code" 
                    render={({ field }) => ( 
                      <FormItem> 
                        <FormLabel className="flex items-center gap-2 text-sm text-muted-foreground"><Tag className="h-4 w-4" /> Cód.</FormLabel> 
                        <FormControl><Input placeholder="Ej: 1001" {...field} /></FormControl> 
                        <FormMessage /> 
                      </FormItem> 
                    )} 
                  />
                  
                  <FormField 
                    control={form.control} 
                    name="labor" 
                    render={({ field }) => ( 
                      <FormItem> 
                        <FormLabel className="flex items-center gap-2 text-sm text-muted-foreground"><Wrench className="h-4 w-4" /> Labor</FormLabel> 
                        <FormControl><Input placeholder="Labor (auto-completado)" {...field} readOnly /></FormControl> 
                        <FormMessage /> 
                      </FormItem> 
                    )} 
                  />

                  <div className="flex justify-end pt-4">
                    <Button type="submit">Guardar Ficha</Button>
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
