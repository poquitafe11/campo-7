
'use client';

import { useEffect, useMemo, useTransition, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
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
  Boxes,
  Grape,
  PlusCircle,
  Trash2,
  Pencil,
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
import { ActivityRecordSchema, type LoteData, type Assistant } from '@/lib/types';
import { saveActivity } from './actions';
import { useAuth } from '@/hooks/useAuth';
import { useMasterData } from '@/context/MasterDataContext';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Dynamically import the Calendar to ensure it's client-side only
const Calendar = dynamic(() => import('@/components/ui/calendar').then(mod => mod.Calendar), {
  ssr: false,
  loading: () => <div className="h-[290px] w-[240px] bg-muted rounded-md animate-pulse" />,
});


const singleActivitySchema = ActivityRecordSchema;
type SingleActivityFormValues = z.infer<typeof singleActivitySchema>;

const groupActivitySchema = z.object({
  assistantDni: z.string().min(1, "Asistente requerido."),
  performance: z.coerce.number(),
  clustersOrJabas: z.coerce.number().optional(),
  personnelCount: z.coerce.number().int().min(1, "Mínimo 1."),
  workdayCount: z.coerce.number(),
  minRange: z.coerce.number(),
  maxRange: z.coerce.number(),
  observations: z.string().optional(),
});

const groupFormSchema = z.object({
  registerDate: z.date({ required_error: "La fecha es requerida." }),
  campaign: z.string().min(1, "La campaña es requerida."),
  stage: z.string().min(1, "La etapa es requerida."),
  lote: z.string().min(1, "El lote es requerido."),
  code: z.string().min(1, "El código es requerido."),
  labor: z.string().optional(),
  shift: z.string().min(1, "El turno es requerido."),
  pass: z.coerce.number(),
  cost: z.coerce.number(),
  activities: z.array(groupActivitySchema).min(1, "Debe agregar al menos una actividad de grupo."),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;


const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">{children}</div>
);

export default function CreateActivityPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { labors, lotes, asistentes, loading: masterLoading } = useMasterData();
  const { setActions } = useHeaderActions();
  const [formMode, setFormMode] = useState<'individual' | 'group'>('individual');

  useEffect(() => {
    setActions({ title: "Crear Ficha de Actividad" });
    return () => setActions({});
  }, [setActions]);

  // Form for single activity
  const singleForm = useForm<SingleActivityFormValues>({
    resolver: zodResolver(singleActivitySchema),
    defaultValues: {
      registerDate: new Date(),
      campaign: '',
      stage: '',
      lote: '',
      code: '',
      labor: '',
      performance: 0,
      clustersOrJabas: 0,
      personnelCount: 1,
      workdayCount: 0,
      cost: 0,
      shift: '',
      minRange: 0,
      maxRange: 0,
      pass: 0,
      observations: '',
      assistantDni: '',
      createdBy: '',
    },
  });

  // Form for group activity
  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      registerDate: new Date(),
      campaign: '',
      stage: '',
      lote: '',
      code: '',
      labor: '',
      shift: '',
      pass: 0,
      cost: 0,
      activities: [],
    },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: groupForm.control,
    name: "activities"
  });

  const codeValue = useWatch({ control: formMode === 'individual' ? singleForm.control : groupForm.control, name: 'code' });
  const activitiesArray = useWatch({ control: groupForm.control, name: 'activities' });
  
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
    const activeForm = formMode === 'individual' ? singleForm : groupForm;
    if (codeValue) {
      const matchedLabor = labors.find(l => l.codigo === codeValue);
      activeForm.setValue('labor', matchedLabor?.descripcion || '', { shouldValidate: true });
    } else {
      activeForm.setValue('labor', '', { shouldValidate: true });
    }
  }, [codeValue, labors, singleForm, groupForm, formMode]);

  useEffect(() => {
    if (profile?.dni) {
      singleForm.setValue('assistantDni', profile.dni);
    }
    if (user?.email) {
      singleForm.setValue('createdBy', user.email);
    }
  }, [profile, user, singleForm]);
  
  const showExtraPerformanceField = useMemo(() => ['46', '67'].includes(codeValue || ''), [codeValue]);
  const performanceLabel = showExtraPerformanceField ? "Rendimiento (Plantas)" : "Rendimiento";
  const extraPerformanceLabel = codeValue === '46' ? "Rendimiento (Racimos)" : "Rendimiento (Jabas)";
  const ExtraPerformanceIcon = codeValue === '46' ? Grape : Boxes;

  const onSingleSubmit = (data: SingleActivityFormValues) => {
    startTransition(async () => {
        const result = await saveActivity(data);
        if (result.success) {
            toast({
                title: 'Éxito',
                description: 'Ficha de actividad guardada correctamente.',
            });
            singleForm.reset({
              registerDate: new Date(),
              campaign: '',
              stage: '',
              lote: '',
              code: '',
              labor: '',
              performance: 0,
              clustersOrJabas: 0,
              personnelCount: 1,
              workdayCount: 0,
              cost: 0,
              shift: '',
              minRange: 0,
              maxRange: 0,
              pass: 0,
              observations: '',
              assistantDni: profile?.dni || '',
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
  
  const onGroupSubmit = (data: GroupFormValues) => {
    startTransition(async () => {
        let successCount = 0;
        for (const activity of data.activities) {
            const fullActivityData: SingleActivityFormValues = {
                ...activity,
                registerDate: data.registerDate,
                campaign: data.campaign,
                stage: data.stage,
                lote: data.lote,
                code: data.code,
                labor: data.labor,
                shift: data.shift,
                pass: data.pass,
                cost: data.cost,
                createdBy: user?.email || '',
            };
            const result = await saveActivity(fullActivityData);
            if (result.success) {
                successCount++;
            }
        }

        if (successCount === data.activities.length) {
             toast({
                title: 'Éxito',
                description: `${successCount} fichas de actividad han sido guardadas.`,
            });
            groupForm.reset();
            remove(); // clear all fields in field array
        } else {
            toast({
                variant: 'destructive',
                title: 'Error Parcial',
                description: `Se guardaron ${successCount} de ${data.activities.length} fichas. Por favor, revise los datos.`,
            });
        }
    });
  };

  const totals = useMemo(() => {
    if (!activitiesArray) return { performance: 0, personnelCount: 0, workdayCount: 0, minRange: 0, maxRange: 0, clustersOrJabas: 0 };
    
    const totals = activitiesArray.reduce((acc, curr) => {
      acc.performance += Number(curr.performance) || 0;
      acc.clustersOrJabas += Number(curr.clustersOrJabas) || 0;
      acc.personnelCount += Number(curr.personnelCount) || 0;
      acc.workdayCount += Number(curr.workdayCount) || 0;
      return acc;
    }, { performance: 0, personnelCount: 0, workdayCount: 0, clustersOrJabas: 0 });

    const minValues = activitiesArray.map(a => Number(a.minRange) || 0).filter(v => v > 0);
    const maxValues = activitiesArray.map(a => Number(a.maxRange) || 0).filter(v => v > 0);
    
    return {
      ...totals,
      minRange: minValues.length > 0 ? Math.min(...minValues) : 0,
      maxRange: maxValues.length > 0 ? Math.max(...maxValues) : 0,
    }

  }, [activitiesArray]);

  const renderSharedHeader = (form: any) => (
    <>
      <FormField
        control={form.control}
        name="registerDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel><IconWrapper><CalendarIcon className="h-4 w-4" /> Fecha de Registro</IconWrapper></FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <FormField control={form.control} name="campaign" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Briefcase className="h-4 w-4" /> Campaña</IconWrapper></FormLabel><FormControl><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="stage" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Flame className="h-4 w-4" /> Etapa</IconWrapper></FormLabel><FormControl><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="formacion">Formacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="lote" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Sprout className="h-4 w-4" /> Lote</IconWrapper></FormLabel><FormControl><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Selecciona"} /></SelectTrigger><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.lote}>{lote.lote}</SelectItem>)}</SelectContent></Select></FormControl><FormMessage /></FormItem>)} />
      </div>

      <div className="grid grid-cols-6 gap-6">
        <FormField control={form.control} name="code" render={({ field }) => ( <FormItem className="col-span-2"> <FormLabel><IconWrapper><Tag className="h-4 w-4" /> Cód.</IconWrapper></FormLabel> <FormControl><Input placeholder="Ej: 1001" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField control={form.control} name="labor" render={({ field }) => ( <FormItem className="col-span-4"> <FormLabel><IconWrapper><Wrench className="h-4 w-4" /> Labor</IconWrapper></FormLabel> <FormControl><Input placeholder="Labor (auto-completado)" {...field} readOnly /></FormControl> <FormMessage /> </FormItem> )} />
      </div>

       <div className="grid grid-cols-3 gap-6">
          <FormField control={form.control} name="cost" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Calculator className="h-4 w-4" /> S/ Costo (PEN)</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
          <FormField control={form.control} name="shift" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Clock className="h-4 w-4" /> Turno</IconWrapper></FormLabel><FormControl><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem></SelectContent></Select></FormControl> <FormMessage /> </FormItem> )} />
          <FormField control={form.control} name="pass" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><RotateCw className="h-4 w-4" /> Pasada</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
       </div>
    </>
  );

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center space-x-2 mb-6">
            <Label htmlFor="form-mode-switch">Registro Individual</Label>
            <Switch
                id="form-mode-switch"
                checked={formMode === 'group'}
                onCheckedChange={(checked) => setFormMode(checked ? 'group' : 'individual')}
            />
            <Label htmlFor="form-mode-switch">Registro por Grupos</Label>
        </div>

        {formMode === 'individual' && (
            <Form {...singleForm}>
                <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-8">
                    <div className="rounded-lg border bg-background p-6 shadow-sm">
                    <div className="space-y-6">
                        {renderSharedHeader(singleForm)}
                        <FormField control={singleForm.control} name="assistantDni" render={({ field }) => (
                           <FormItem> <FormLabel><IconWrapper><UserIcon className="h-4 w-4" /> Asistente</IconWrapper></FormLabel><FormControl><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger><SelectContent>{asistentes.map(a => <SelectItem key={a.id} value={a.id}>{a.assistantName}</SelectItem>)}</SelectContent></Select></FormControl><FormMessage /></FormItem>
                        )}/>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <FormField control={singleForm.control} name="performance" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><TrendingUp className="h-4 w-4" /> {performanceLabel}</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                            {showExtraPerformanceField && (
                                <FormField control={singleForm.control} name="clustersOrJabas" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><ExtraPerformanceIcon className="h-4 w-4" /> {extraPerformanceLabel}</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                            )}
                            <FormField control={singleForm.control} name="personnelCount" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Users className="h-4 w-4" /> # Personas</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="1" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                            <FormField control={singleForm.control} name="workdayCount" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><ClipboardList className="h-4 w-4" /> # Jornadas (JHU)</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <FormField control={singleForm.control} name="minRange" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><FileInput className="h-4 w-4" /> Min</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                            <FormField control={singleForm.control} name="maxRange" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><FileOutput className="h-4 w-4"/> Max</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="0" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                        </div>
                        
                        <FormField control={singleForm.control} name="observations" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Wrench className="h-4 w-4" /> Observaciones</IconWrapper></FormLabel> <FormControl><Textarea placeholder="Escribe aquí tus observaciones..." {...field} /></FormControl> <FormMessage /> </FormItem> )} />

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
        )}
        
        {formMode === 'group' && (
          <Form {...groupForm}>
            <form onSubmit={groupForm.handleSubmit(onGroupSubmit)} className="space-y-8">
               <div className="rounded-lg border bg-background p-6 shadow-sm space-y-6">
                 {renderSharedHeader(groupForm)}
                  
                  <div className="space-y-2 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Asistente</TableHead>
                          <TableHead>{performanceLabel}</TableHead>
                          {showExtraPerformanceField && <TableHead>{extraPerformanceLabel}</TableHead>}
                          <TableHead>Personas</TableHead>
                          <TableHead>Jhu</TableHead>
                          <TableHead>Mínimo</TableHead>
                          <TableHead>Máximo</TableHead>
                          <TableHead className="w-[150px]">Obs.</TableHead>
                          <TableHead className="w-[80px] text-center">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((field, index) => (
                           <TableRow key={field.id}>
                              <TableCell>
                                <FormField control={groupForm.control} name={`activities.${index}.assistantDni`} render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger></FormControl><SelectContent>{asistentes.map(a => <SelectItem key={a.id} value={a.id}>{a.assistantName}</SelectItem>)}</SelectContent></Select>
                                )}/>
                              </TableCell>
                              <TableCell><FormField control={groupForm.control} name={`activities.${index}.performance`} render={({ field }) => <Input type="number" {...field} />}/></TableCell>
                              {showExtraPerformanceField && <TableCell><FormField control={groupForm.control} name={`activities.${index}.clustersOrJabas`} render={({ field }) => <Input type="number" {...field} />}/></TableCell>}
                              <TableCell><FormField control={groupForm.control} name={`activities.${index}.personnelCount`} render={({ field }) => <Input type="number" {...field} />}/></TableCell>
                              <TableCell><FormField control={groupForm.control} name={`activities.${index}.workdayCount`} render={({ field }) => <Input type="number" {...field} />}/></TableCell>
                              <TableCell><FormField control={groupForm.control} name={`activities.${index}.minRange`} render={({ field }) => <Input type="number" {...field} />}/></TableCell>
                              <TableCell><FormField control={groupForm.control} name={`activities.${index}.maxRange`} render={({ field }) => <Input type="number" {...field} />}/></TableCell>
                              <TableCell><FormField control={groupForm.control} name={`activities.${index}.observations`} render={({ field }) => <Input {...field} />}/></TableCell>
                              <TableCell className="text-center">
                                <div className="flex gap-1">
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4 text-blue-600"/></Button>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </div>
                              </TableCell>
                           </TableRow>
                        ))}
                      </TableBody>
                       <TableFooter>
                          <TableRow>
                            <TableCell className="font-bold">Total</TableCell>
                            <TableCell className="font-bold text-center">{totals.performance.toLocaleString('es-PE')}</TableCell>
                            {showExtraPerformanceField && <TableCell className="font-bold text-center">{totals.clustersOrJabas.toLocaleString('es-PE')}</TableCell>}
                            <TableCell className="font-bold text-center">{totals.personnelCount}</TableCell>
                            <TableCell className="font-bold text-center">{totals.workdayCount.toFixed(1)}</TableCell>
                            <TableCell className="font-bold text-center">{totals.minRange}</TableCell>
                            <TableCell className="font-bold text-center">{totals.maxRange}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                       </TableFooter>
                    </Table>
                     <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ assistantDni: '', performance: 0, personnelCount: 1, workdayCount: 0, minRange: 0, maxRange: 0, observations: '', clustersOrJabas: 0 })}>
                        <PlusCircle className="mr-2 h-4 w-4"/> Agregar Fila
                    </Button>
                  </div>
                 <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isPending || masterLoading}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar {fields.length} Registros
                  </Button>
                </div>
               </div>
            </form>
          </Form>
        )}
      </div>
    </>
  );
}
