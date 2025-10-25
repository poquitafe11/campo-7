
'use client';

import { useEffect, useMemo, useTransition, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Users,
  Sprout,
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
  User,
  Wrench,
  FileInput,
  FileOutput,
  Tag,
  Hash,
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
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AddAssistantActivityDialog from '@/components/AddAssistantActivityDialog';

const Calendar = dynamic(() => import('@/components/ui/calendar').then(mod => mod.Calendar), {
  ssr: false,
  loading: () => <div className="h-[290px] w-[240px] bg-muted rounded-md animate-pulse" />,
});


const singleActivitySchema = ActivityRecordSchema;
type SingleActivityFormValues = z.infer<typeof singleActivitySchema>;

export type GroupActivityRow = {
  id: string;
  assistantDni: string;
  assistantName: string;
  performance: number;
  clustersOrJabas?: number;
  personnelCount: number;
  workdayCount: number;
  minRange: number;
  maxRange: number;
  observations?: string;
};

const groupFormSchema = z.object({
  registerDate: z.date({ required_error: "La fecha es requerida." }),
  campaign: z.string().min(1, "La campaña es requerida."),
  stage: z.string().optional(),
  lote: z.string().min(1, "El lote es requerido."),
  code: z.string().min(1, "El código es requerido."),
  labor: z.string().optional(),
  shift: z.string().min(1, "El turno es requerido."),
  pass: z.coerce.number().optional(),
  cost: z.coerce.number().optional(),
  activities: z.array(z.object({
      id: z.string(),
      assistantDni: z.string(),
      assistantName: z.string(),
      performance: z.any(),
      clustersOrJabas: z.any().optional(),
      personnelCount: z.coerce.number().int().min(1),
      workdayCount: z.any(),
      minRange: z.any(),
      maxRange: z.any(),
      observations: z.string().optional(),
  }))
});

type GroupFormValues = z.infer<typeof groupFormSchema>;


const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">{children}</div>
);

function GroupFormTotals({ control, showExtraPerformanceField }: { control: any, showExtraPerformanceField: boolean }) {
  const activities = useWatch({ control, name: 'activities' });

  const totals = useMemo(() => {
    if (!activities || activities.length === 0) return { performance: 0, personnelCount: 0, workdayCount: 0, minRange: 0, maxRange: 0, clustersOrJabas: 0 };
    
    const totals = activities.reduce((acc: any, curr: any) => {
      acc.performance += Number(curr.performance) || 0;
      acc.clustersOrJabas += Number(curr.clustersOrJabas) || 0;
      acc.personnelCount += Number(curr.personnelCount) || 0;
      acc.workdayCount += Number(curr.workdayCount) || 0;
      return acc;
    }, { performance: 0, personnelCount: 0, workdayCount: 0, clustersOrJabas: 0 });

    const minValues = activities.map((a: any) => Number(a.minRange)).filter((v: number) => v > 0);
    const maxValues = activities.map((a: any) => Number(a.maxRange)).filter((v: number) => v > 0);
    
    return {
      ...totals,
      minRange: minValues.length > 0 ? Math.min(...minValues) : 0,
      maxRange: maxValues.length > 0 ? Math.max(...maxValues) : 0,
    }
  }, [activities]);

  return (
    <TableRow>
      <TableCell colSpan={showExtraPerformanceField ? 2 : 1} className="font-bold text-right">Total</TableCell>
      <TableCell className="font-bold text-center">{totals.performance.toLocaleString('es-PE')}</TableCell>
      {showExtraPerformanceField && <TableCell className="font-bold text-center">{totals.clustersOrJabas.toLocaleString('es-PE')}</TableCell>}
      <TableCell className="font-bold text-center">{totals.personnelCount}</TableCell>
      <TableCell className="font-bold text-center">{totals.workdayCount.toFixed(1)}</TableCell>
      <TableCell className="font-bold text-center">{totals.minRange}</TableCell>
      <TableCell className="font-bold text-center">{totals.maxRange}</TableCell>
      <TableCell colSpan={2}></TableCell>
    </TableRow>
  );
}


export default function CreateActivityPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { labors, lotes, asistentes, loading: masterLoading, refreshData } = useMasterData();
  const { setActions } = useHeaderActions();
  const [formMode, setFormMode] = useState<'individual' | 'group'>('individual');
  
  const [isAddActivityDialogOpen, setAddActivityDialogOpen] = useState(false);

  useEffect(() => {
    setActions({ title: "Crear Ficha de Actividad" });
    return () => setActions({});
  }, [setActions]);

  const singleForm = useForm<SingleActivityFormValues>({
    resolver: zodResolver(singleActivitySchema),
    defaultValues: {
      registerDate: new Date(),
      campaign: '',
      stage: '',
      lote: '',
      code: '',
      labor: '',
      performance: '',
      clustersOrJabas: '',
      personnelCount: 1,
      workdayCount: '',
      cost: '',
      shift: '',
      minRange: '',
      maxRange: '',
      pass: '',
      observations: '',
      assistantDni: '',
      createdBy: '',
    },
  });

  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      registerDate: new Date(),
      campaign: '2025',
      stage: '',
      lote: '',
      code: '',
      labor: '',
      shift: 'Mañana',
      pass: 0,
      cost: 0,
      activities: []
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: groupForm.control,
    name: 'activities'
  });
  
  const singleCodeValue = useWatch({ control: singleForm.control, name: 'code' });
  const groupCodeValue = useWatch({ control: groupForm.control, name: 'code' });
  
  const activeForm = formMode === 'individual' ? singleForm : groupForm;
  const codeValue = formMode === 'individual' ? singleCodeValue : groupCodeValue;
  
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
      const matchedLabor = labors.find(l => String(l.codigo) === String(codeValue));
      activeForm.setValue('labor', matchedLabor?.descripcion || '', { shouldValidate: true });
    } else {
      activeForm.setValue('labor', '', { shouldValidate: true });
    }
  }, [codeValue, labors, activeForm]);


  useEffect(() => {
    if (profile?.nombre) {
      singleForm.setValue('createdBy', profile.nombre);
      if(profile.dni) {
          singleForm.setValue('assistantDni', profile.dni);
      }
    }
  }, [profile, singleForm]);
  
  const showExtraPerformanceField = useMemo(() => ['46', '67'].includes(String(codeValue) || ''), [codeValue]);
  const performanceLabel = showExtraPerformanceField ? "Plantas" : "Rendimiento";
  const extraPerformanceLabel = String(codeValue) === '46' ? "Racimos" : "Jabas";
  const ExtraPerformanceIcon = String(codeValue) === '46' ? Grape : Boxes;

  const onSingleSubmit = (data: SingleActivityFormValues) => {
    if (!profile?.nombre) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario.' });
      return;
    }
    startTransition(async () => {
        const result = await saveActivity({...data, createdBy: profile.nombre});
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
              performance: '',
              clustersOrJabas: '',
              personnelCount: 1,
              workdayCount: '',
              cost: '',
              shift: '',
              minRange: '',
              maxRange: '',
              pass: '',
              observations: '',
              assistantDni: profile?.dni || '',
              createdBy: profile?.nombre || '',
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
    if (!profile?.nombre) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario.' });
      return;
    }
    startTransition(async () => {
        let successCount = 0;
        for (const activity of data.activities) {
            const fullActivityData: SingleActivityFormValues = {
                registerDate: data.registerDate,
                campaign: data.campaign,
                stage: data.stage || '',
                lote: data.lote,
                code: data.code,
                labor: data.labor || '',
                shift: data.shift,
                pass: data.pass || 0,
                cost: data.cost || 0,
                createdBy: profile.nombre,
                assistantDni: activity.assistantDni,
                performance: activity.performance || 0,
                clustersOrJabas: activity.clustersOrJabas || 0,
                personnelCount: activity.personnelCount,
                workdayCount: activity.workdayCount || 0,
                minRange: activity.minRange || 0,
                maxRange: activity.maxRange || 0,
                observations: activity.observations || ''
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
            groupForm.reset({
              registerDate: new Date(),
              campaign: '2025',
              stage: '',
              lote: '',
              code: '',
              labor: '',
              shift: 'Mañana',
              pass: 0,
              cost: 0,
              activities: []
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Error Parcial',
                description: `Se guardaron ${successCount} de ${data.activities.length} fichas. Por favor, revise los datos.`,
            });
        }
    });
  };

  const handleAddAssistant = (assistant: { assistantDni: string, assistantName: string }) => {
    append({
        id: crypto.randomUUID(),
        assistantDni: assistant.assistantDni,
        assistantName: assistant.assistantName,
        performance: '',
        clustersOrJabas: '',
        personnelCount: 1,
        workdayCount: '',
        minRange: '',
        maxRange: '',
        observations: '',
    });
  };
  
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

        {formMode === 'individual' ? (
          <Form {...singleForm}>
              <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-6">
                  <div className="rounded-lg border bg-background p-6 shadow-sm">
                    <div className="space-y-6">
                        
                        <FormField control={singleForm.control} name="registerDate" render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="flex items-center gap-2 text-muted-foreground"><CalendarIcon/>Fecha de Registro</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <FormField control={singleForm.control} name="campaign" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Briefcase /> Campaña</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select><FormMessage /> </FormItem> )} />
                          <FormField control={singleForm.control} name="stage" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Flame /> Etapa</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="formacion">Formacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select><FormMessage /> </FormItem> )} />
                          <FormField control={singleForm.control} name="lote" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Sprout /> Lote</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.lote}>{lote.lote}</SelectItem>)}</SelectContent></Select><FormMessage /> </FormItem> )} />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={singleForm.control} name="code" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Tag /> Cód.</IconWrapper></FormLabel> <FormControl><Input placeholder="Ej: 1001" {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )} />
                            <FormField control={singleForm.control} name="labor" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Wrench /> Labor</IconWrapper></FormLabel> <FormControl><Input placeholder="Labor (auto-completado)" {...field} readOnly /></FormControl> <FormMessage /> </FormItem> )} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                           <FormField control={singleForm.control} name="performance" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><TrendingUp /> {performanceLabel}</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} value={field.value || ''}/></FormControl> <FormMessage /> </FormItem> )} />
                           <FormField control={singleForm.control} name="personnelCount" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Users/> # Personas</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )} />
                           <FormField control={singleForm.control} name="workdayCount" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><ClipboardList/> # Jornadas (JHU)</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )} />
                        </div>
                         {showExtraPerformanceField && (
                             <FormField control={singleForm.control} name="clustersOrJabas" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><ExtraPerformanceIcon />{extraPerformanceLabel}</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )} />
                          )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                           <FormField control={singleForm.control} name="cost" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Calculator /> S/ Costo (PEN)</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )} />
                           <FormField control={singleForm.control} name="shift" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Clock /> Turno</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem><SelectItem value="Noche">Noche</SelectItem></SelectContent></Select><FormMessage /> </FormItem> )} />
                           <FormField control={singleForm.control} name="pass" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><RotateCw /> Pasada</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} value={field.value || ''}/></FormControl> <FormMessage /> </FormItem> )} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField control={singleForm.control} name="minRange" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><FileInput /> Min</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )} />
                          <FormField control={singleForm.control} name="maxRange" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><FileOutput /> Max</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )} />
                        </div>
                        
                        <FormField control={singleForm.control} name="observations" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Pencil /> Observaciones</IconWrapper></FormLabel> <FormControl><Textarea placeholder="Escribe aquí tus observaciones..." {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )} />
                  
                    </div>
                    <div className="flex justify-end pt-8">
                        <Button type="submit" disabled={isPending || masterLoading}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Ficha
                        </Button>
                    </div>
                  </div>
              </form>
          </Form>
        ) : (
          <Form {...groupForm}>
            <form onSubmit={groupForm.handleSubmit(onGroupSubmit)} className="space-y-6">
               <div className="rounded-lg border bg-background p-4 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                      <FormField control={groupForm.control} name="registerDate" render={({ field }) => (<FormItem className="flex-1"><FormLabel className="font-semibold">Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button size="sm" variant="outline" className="font-normal w-full justify-start h-8">{field.value ? format(field.value, 'P', { locale: es }) : <span>Elige</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover></FormItem>)}/>
                      <FormField control={groupForm.control} name="lote" render={({ field }) => (<FormItem className="flex-1"><FormLabel className="font-semibold">Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.lote}>{lote.lote}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                      <FormField control={groupForm.control} name="campaign" render={({ field }) => (<FormItem className="flex-1"><FormLabel className="font-semibold">Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select></FormItem>)} />
                      <FormField control={groupForm.control} name="cost" render={({ field }) => ( <FormItem className="flex-1"> <FormLabel className="font-semibold">S/ Costo</FormLabel> <FormControl><Input className="h-8" type="number" placeholder="" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                      <FormField control={groupForm.control} name="pass" render={({ field }) => ( <FormItem className="flex-1"> <FormLabel className="font-semibold">Pasada</FormLabel> <FormControl><Input className="h-8" type="number" placeholder="" {...field} value={field.value || ''}/></FormControl></FormItem> )} />
                      <FormField control={groupForm.control} name="shift" render={({ field }) => ( <FormItem className="flex-1"> <FormLabel className="font-semibold">Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Selecciona..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem><SelectItem value="Noche">Noche</SelectItem></SelectContent></Select></FormItem> )} />
                    </div>
                    <div className="flex gap-4 items-end">
                      <FormField control={groupForm.control} name="code" render={({ field }) => (<FormItem className="w-1/4"><FormLabel className="font-semibold">Cod. Labor</FormLabel><FormControl><Input className="h-8" {...field} value={field.value || ''} /></FormControl></FormItem>)} />
                      <FormField control={groupForm.control} name="labor" render={({ field }) => (<FormItem className="flex-1"><FormLabel className="font-semibold">Labor</FormLabel><FormControl><Input className="h-8" {...field} readOnly /></FormControl></FormItem>)} />
                    </div>
                    <div className="space-y-2 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px]">Asistente</TableHead>
                                    <TableHead className="min-w-[120px]">{performanceLabel}</TableHead>
                                    {showExtraPerformanceField && <TableHead className="min-w-[120px]">{extraPerformanceLabel}</TableHead>}
                                    <TableHead className="min-w-[100px]">Personas</TableHead>
                                    <TableHead className="min-w-[100px]">Jhu</TableHead>
                                    <TableHead className="min-w-[100px]">Mínimo</TableHead>
                                    <TableHead className="min-w-[100px]">Máximo</TableHead>
                                    <TableHead className="min-w-[150px]">Obs.</TableHead>
                                    <TableHead className="w-[80px] text-center">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell className="font-medium whitespace-nowrap">{field.assistantName}</TableCell>
                                    <TableCell><FormField control={groupForm.control} name={`activities.${index}.performance`} render={({ field }) => <Input type="number" {...field} className="w-24 h-8" value={field.value || ''} />}/></TableCell>
                                    {showExtraPerformanceField && <TableCell><FormField control={groupForm.control} name={`activities.${index}.clustersOrJabas`} render={({ field }) => <Input type="number" {...field} className="w-24 h-8" value={field.value || ''}/>} /></TableCell>}
                                    <TableCell><FormField control={groupForm.control} name={`activities.${index}.personnelCount`} render={({ field }) => <Input type="number" {...field} className="w-20 h-8" value={field.value || ''}/>} /></TableCell>
                                    <TableCell><FormField control={groupForm.control} name={`activities.${index}.workdayCount`} render={({ field }) => <Input type="number" {...field} className="w-20 h-8" value={field.value || ''}/>} /></TableCell>
                                    <TableCell><FormField control={groupForm.control} name={`activities.${index}.minRange`} render={({ field }) => <Input type="number" {...field} className="w-20 h-8" value={field.value || ''}/>} /></TableCell>
                                    <TableCell><FormField control={groupForm.control} name={`activities.${index}.maxRange`} render={({ field }) => <Input type="number" {...field} className="w-20 h-8" value={field.value || ''}/>} /></TableCell>
                                    <TableCell><FormField control={groupForm.control} name={`activities.${index}.observations`} render={({ field }) => <Input {...field} className="w-36 h-8" value={field.value || ''}/>} /></TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex gap-1 justify-center">
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <GroupFormTotals control={groupForm.control} showExtraPerformanceField={showExtraPerformanceField} />
                            </TableFooter>
                        </Table>
                        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setAddActivityDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4"/> Agregar Fila
                        </Button>
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isPending || masterLoading || fields.length === 0}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar {fields.length} Registros
                        </Button>
                    </div>
               </div>
            </form>
          </Form>
        )}
      </div>

       <AddAssistantActivityDialog
          isOpen={isAddActivityDialogOpen}
          setIsOpen={setAddActivityDialogOpen}
          onSelectAssistant={handleAddAssistant}
          currentAssistantsDnis={fields.map(f => f.assistantDni)}
       />
    </>
  );
}
