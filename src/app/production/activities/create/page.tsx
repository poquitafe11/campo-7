

"use client";

import { useEffect, useMemo, useTransition, useState, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
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
  User,
  Wrench,
  FileInput,
  FileOutput,
  Tag,
  Pencil,
  Save,
  Camera,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import html2canvas from 'html2canvas';

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


type SingleActivityFormValues = z.infer<typeof ActivityRecordSchema>;

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
      performance: z.coerce.number(),
      clustersOrJabas: z.coerce.number().optional(),
      personnelCount: z.coerce.number().int().min(1),
      workdayCount: z.coerce.number(),
      minRange: z.coerce.number(),
      maxRange: z.coerce.number(),
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
      if (!activities || activities.length === 0) return { performance: 0, personnelCount: 0, workdayCount: 0, clustersOrJabas: 0, minRange: 0, maxRange: 0 };
      
      return activities.reduce((acc: any, curr: any) => {
        acc.performance += Number(curr.performance) || 0;
        acc.clustersOrJabas += Number(curr.clustersOrJabas) || 0;
        acc.personnelCount += Number(curr.personnelCount) || 0;
        acc.workdayCount += Number(curr.workdayCount) || 0;
        
        const min = Number(curr.minRange) || 0;
        const max = Number(curr.maxRange) || 0;
        
        if (min > 0) {
          acc.minRange = acc.minRange === 0 ? min : Math.min(acc.minRange, min);
        }
        if (max > 0) {
          acc.maxRange = Math.max(acc.maxRange, max);
        }
        
        return acc;
      }, { performance: 0, personnelCount: 0, workdayCount: 0, clustersOrJabas: 0, minRange: 0, maxRange: 0 });
    }, [activities]);

    return (
      <TableRow>
        <TableCell colSpan={1} className="font-bold text-right">Total</TableCell>
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

const formatAssistantName = (name: string) => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length < 2) return name;
    const firstName = parts[0];
    const lastNameInitial = parts[parts.length - 1].charAt(0).toUpperCase() + '.';
    return `${firstName} ${lastNameInitial}`;
};


export default function CreateActivityPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { labors, lotes, asistentes, loading: masterLoading, refreshData } = useMasterData();
  const { setActions } = useHeaderActions();
  const [formMode, setFormMode] = useState<'individual' | 'group'>('individual');
  const tableRef = useRef<HTMLTableElement>(null);
  
  const [isAddActivityDialogOpen, setAddActivityDialogOpen] = useState(false);

  useEffect(() => {
    setActions({ title: "Crear Ficha de Actividad" });
    return () => setActions({});
  }, [setActions]);

  const singleForm = useForm<SingleActivityFormValues>({
    resolver: zodResolver(ActivityRecordSchema),
    defaultValues: {
      registerDate: new Date(),
      campaign: '',
      stage: '',
      lote: '',
      code: '',
      labor: '',
      performance: "" as any,
      clustersOrJabas: "" as any,
      personnelCount: 1,
      workdayCount: "" as any,
      cost: "" as any,
      shift: '',
      minRange: "" as any,
      maxRange: "" as any,
      pass: "" as any,
      observations: '',
      assistantDni: '',
      assistantName: '',
      createdBy: '',
    },
  });

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
      activities: []
    },
  });
  
  useEffect(() => {
    if (formMode === 'individual') {
        groupForm.reset();
    } else {
        singleForm.reset();
    }
  }, [formMode, groupForm, singleForm]);

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
    }
     if (profile?.dni) {
       singleForm.setValue('assistantDni', profile.dni);
    }
  }, [profile, singleForm]);
  
  const showExtraPerformanceField = useMemo(() => ['46', '67'].includes(String(codeValue) || ''), [codeValue]);
  const performanceLabel = showExtraPerformanceField ? "Rdto (Plta)" : "Rdto";
  const extraPerformanceLabel = String(codeValue) === '46' ? "Racimos" : "Jabas";
  const ExtraPerformanceIcon = String(codeValue) === '46' ? Grape : Boxes;

  const onSingleSubmit = (data: SingleActivityFormValues) => {
    if (!profile?.nombre || !profile?.dni) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario.' });
      return;
    }
    
    startTransition(async () => {
        const result = await saveActivity({
          ...data,
          assistantDni: profile.dni,
          assistantName: profile.nombre,
          createdBy: profile.nombre,
        });
        if (result.success) {
            toast({
                title: 'Éxito',
                description: 'Ficha de actividad guardada correctamente.',
            });
            singleForm.reset({
              ...singleForm.getValues(),
              code: '',
              labor: '',
              performance: "" as any,
              clustersOrJabas: "" as any,
              personnelCount: 1,
              workdayCount: "" as any,
              cost: "" as any,
              minRange: "" as any,
              maxRange: "" as any,
              pass: "" as any,
              observations: '',
              createdBy: profile?.nombre || '',
              assistantDni: profile?.dni || ''
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
                assistantName: activity.assistantName,
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
              campaign: '',
              stage: '',
              lote: '',
              code: '',
              labor: '',
              shift: '',
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
        performance: 0,
        clustersOrJabas: 0,
        personnelCount: 1, 
        workdayCount: 0,
        minRange: 0,
        maxRange: 0,
        observations: '',
    });
  };
  
  const handleCapture = async () => {
    if (!tableRef.current) return;
    toast({ title: 'Capturando...', description: 'Generando imagen de la tabla.' });

    const activitiesData = groupForm.getValues('activities');
    const totalsData = activitiesData.reduce((acc, curr) => {
        acc.performance += Number(curr.performance) || 0;
        acc.clustersOrJabas += Number(curr.clustersOrJabas) || 0;
        acc.personnelCount += Number(curr.personnelCount) || 0;
        acc.workdayCount += Number(curr.workdayCount) || 0;
        const min = Number(curr.minRange) || 0;
        const max = Number(curr.maxRange) || 0;
        if (min > 0) acc.minRange = acc.minRange === 0 ? min : Math.min(acc.minRange, min);
        if (max > 0) acc.maxRange = Math.max(acc.maxRange, max);
        return acc;
      }, { performance: 0, clustersOrJabas: 0, personnelCount: 0, workdayCount: 0, minRange: 0, maxRange: 0 });

    const headerRow = `
        <tr style="background-color: #f3f4f6; font-weight: bold;">
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Asistente</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb;">${performanceLabel}</th>
            ${showExtraPerformanceField ? `<th style="padding: 8px; border: 1px solid #e5e7eb;">${extraPerformanceLabel}</th>` : ''}
            <th style="padding: 8px; border: 1px solid #e5e7eb;">Personas</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb;">JHU</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb;">Mínimo</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb;">Máximo</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb;">Obs.</th>
        </tr>`;

    const bodyRows = activitiesData.map(row => `
        <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${row.assistantName}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${row.performance || ''}</td>
            ${showExtraPerformanceField ? `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${row.clustersOrJabas || ''}</td>` : ''}
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${row.personnelCount}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${row.workdayCount || ''}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${row.minRange || ''}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${row.maxRange || ''}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${row.observations || ''}</td>
        </tr>`).join('');
    
    const footerRow = `
        <tr style="font-weight: bold; background-color: #f3f4f6;">
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Total</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${totalsData.performance.toLocaleString('es-PE')}</td>
             ${showExtraPerformanceField ? `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${totalsData.clustersOrJabas.toLocaleString('es-PE')}</td>` : ''}
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${totalsData.personnelCount}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${totalsData.workdayCount.toFixed(1)}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${totalsData.minRange}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${totalsData.maxRange}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
        </tr>`;

    const captureContainer = document.createElement('div');
    captureContainer.style.position = 'absolute';
    captureContainer.style.left = '-9999px';
    captureContainer.style.background = 'white';
    
    captureContainer.innerHTML = `
        <table style="border-collapse: collapse; font-family: sans-serif; font-size: 14px;">
            <thead>${headerRow}</thead>
            <tbody>${bodyRows}</tbody>
            <tfoot>${footerRow}</tfoot>
        </table>`;
    
    document.body.appendChild(captureContainer);

    try {
        const canvas = await html2canvas(captureContainer, {
            scale: 2,
            useCORS: true,
        });
        const link = document.createElement('a');
        link.download = `registro-grupal-${format(new Date(), 'yyyy-MM-dd')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error("Error capturing table: ", error);
        toast({ title: 'Error de Captura', description: 'No se pudo generar la imagen.', variant: 'destructive'});
    } finally {
        document.body.removeChild(captureContainer);
    }
  };


  const renderSharedHeader = (formInstance: any) => (
    <>
      <FormField control={formInstance.control} name="registerDate" render={({ field }) => (
          <FormItem><FormLabel><IconWrapper><CalendarIcon className="h-4 w-4" />Fecha de Registro</IconWrapper></FormLabel>
            <Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-3 gap-4">
          <FormField control={formInstance.control} name="campaign" render={({ field }) => (
            <FormItem><FormLabel><IconWrapper><Briefcase/>Campaña</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select><FormMessage/></FormItem>
          )}/>
          <FormField control={formInstance.control} name="stage" render={({ field }) => (
            <FormItem><FormLabel><IconWrapper><Flame/>Etapa</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="formacion">Formacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select><FormMessage/></FormItem>
          )}/>
          <FormField control={formInstance.control} name="lote" render={({ field }) => (
            <FormItem><FormLabel><IconWrapper><Sprout/>Lote</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.lote}>{lote.lote}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
          )}/>
      </div>
       <div className="grid grid-cols-2 gap-4">
        <FormField control={formInstance.control} name="code" render={({ field }) => (
          <FormItem><FormLabel><IconWrapper><Tag/>Cód.</IconWrapper></FormLabel><FormControl><Input placeholder="Ej: 1001" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>
        )}/>
        <FormField control={formInstance.control} name="labor" render={({ field }) => (
          <FormItem><FormLabel><IconWrapper><Wrench/>Labor</IconWrapper></FormLabel><FormControl><Input placeholder="Labor (auto-completado)" {...field} readOnly /></FormControl><FormMessage/></FormItem>
        )}/>
      </div>
    </>
  );

  return (
    <>
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center space-x-2 mb-6">
            <Label htmlFor="form-mode-switch">Individual</Label>
            <Switch
                id="form-mode-switch"
                checked={formMode === 'group'}
                onCheckedChange={(checked) => setFormMode(checked ? 'group' : 'individual')}
            />
            <Label htmlFor="form-mode-switch">Grupos</Label>
        </div>

        {formMode === 'individual' ? (
          <Form {...singleForm}>
             <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-6">
                <div className="rounded-lg border bg-card text-card-foreground p-6 shadow-sm space-y-6">
                    
                  <FormField control={singleForm.control} name="registerDate" render={({ field }) => (<FormItem><FormLabel><IconWrapper><CalendarIcon className="h-4 w-4"/>Fecha de Registro</IconWrapper></FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage/></FormItem>)}/>
                   
                  <div className="grid grid-cols-3 md:grid-cols-3 gap-x-4 gap-y-6">
                      <FormField control={singleForm.control} name="campaign" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Briefcase className="h-4 w-4"/>Campaña</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
                      <FormField control={singleForm.control} name="stage" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Flame className="h-4 w-4"/>Etapa</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="formacion">Formacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
                      <FormField control={singleForm.control} name="lote" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Sprout className="h-4 w-4"/>Lote</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.lote}>{lote.lote}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-2 gap-x-2 gap-y-4">
                      <FormField control={singleForm.control} name="code" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Tag className="h-4 w-4"/>Cód.</IconWrapper></FormLabel><FormControl><Input placeholder="Ej: 1001" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)}/>
                      <FormField control={singleForm.control} name="labor" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Wrench className="h-4 w-4"/>Labor</IconWrapper></FormLabel><FormControl><Input placeholder="Labor (auto-completado)" {...field} readOnly /></FormControl><FormMessage/></FormItem>)}/>
                  </div>
                  
                   <div className="grid grid-cols-3 md:grid-cols-3 gap-x-4 gap-y-6">
                        <FormField control={singleForm.control} name="performance" render={({ field }) => (<FormItem><FormLabel><IconWrapper><TrendingUp className="h-4 w-4"/>{performanceLabel}</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                        {showExtraPerformanceField && (<FormField control={singleForm.control} name="clustersOrJabas" render={({ field }) => (<FormItem><FormLabel><IconWrapper><ExtraPerformanceIcon className="h-4 w-4" />{extraPerformanceLabel}</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/> )}
                         <FormField control={singleForm.control} name="personnelCount" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Users className="h-4 w-4"/># Peronas</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="1" {...field}  /></FormControl><FormMessage/></FormItem>)}/>
                        <FormField control={singleForm.control} name="workdayCount" render={({ field }) => (<FormItem><FormLabel><IconWrapper><ClipboardList className="h-4 w-4"/># Jornadas (JHU)</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                    </div>
                    
                     <div className="grid grid-cols-3 md:grid-cols-3 gap-x-4 gap-y-6">
                         <FormField control={singleForm.control} name="cost" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Calculator className="h-4 w-4"/>S/ Costo (PEN)</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                         <FormField control={singleForm.control} name="shift" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Clock className="h-4 w-4"/>Turno</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc."/></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem><SelectItem value="Noche">Noche</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
                         <FormField control={singleForm.control} name="pass" render={({ field }) => (<FormItem><FormLabel><IconWrapper><RotateCw className="h-4 w-4"/>Pasada</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                     </div>
                      
                     <div className="grid grid-cols-2 md:grid-cols-2 gap-x-4 gap-y-6">
                         <FormField control={singleForm.control} name="minRange" render={({ field }) => (<FormItem><FormLabel><IconWrapper><FileInput className="h-4 w-4"/>Min</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                         <FormField control={singleForm.control} name="maxRange" render={({ field }) => (<FormItem><FormLabel><IconWrapper><FileOutput className="h-4 w-4"/>Max</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                     </div>
                      
                     <FormField control={singleForm.control} name="observations" render={({ field }) => ( <FormItem><FormLabel><IconWrapper><Pencil className="h-4 w-4"/>Observaciones</IconWrapper></FormLabel> <FormControl><Textarea placeholder="Escribe aquí tus observaciones..." {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                  </div>
                   <div className="flex justify-end pt-4">
                       <Button type="submit" disabled={isPending || masterLoading}>
                           {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                           Guardar Ficha
                       </Button>
                   </div>
             </form>
           </Form>
        ) : (
          <Form {...groupForm}>
            <form onSubmit={groupForm.handleSubmit(onGroupSubmit)} className="space-y-6">
               <div className="rounded-lg border bg-card text-card-foreground p-4 shadow-sm space-y-4">
                    {renderSharedHeader(groupForm)}

                    <div className="grid grid-cols-3 md:grid-cols-3 gap-x-4 gap-y-6">
                      <FormField control={groupForm.control} name="cost" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Calculator className="h-4 w-4"/>S/ Costo (PEN)</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                      <FormField control={groupForm.control} name="shift" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Clock className="h-4 w-4"/>Turno</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem><SelectItem value="Noche">Noche</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
                      <FormField control={groupForm.control} name="pass" render={({ field }) => (<FormItem><FormLabel><IconWrapper><RotateCw className="h-4 w-4"/>Pasada</IconWrapper></FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                    </div>

                    <div className="overflow-x-auto" ref={tableRef}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px]">Asistente</TableHead>
                                    <TableHead className="min-w-[120px]">{performanceLabel}</TableHead>
                                    {showExtraPerformanceField && <TableHead className="min-w-[120px]">{extraPerformanceLabel}</TableHead>}
                                    <TableHead className="min-w-[100px]">Personas</TableHead>
                                    <TableHead className="min-w-[100px]">JHU</TableHead>
                                    <TableHead className="min-w-[100px]">Mínimo</TableHead>
                                    <TableHead className="min-w-[100px]">Máximo</TableHead>
                                    <TableHead className="min-w-[150px]">Obs.</TableHead>
                                    <TableHead className="w-[80px] text-center print-hide">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell className="font-medium whitespace-nowrap">{field.assistantName}</TableCell>
                                    <TableCell>
                                        <FormField control={groupForm.control} name={`activities.${index}.performance`} render={({ field: formField }) => (
                                            <div className="relative">
                                                <Input type="number" {...formField} className="w-24 h-8" />
                                            </div>
                                        )}/>
                                    </TableCell>
                                    {showExtraPerformanceField && <TableCell>
                                        <FormField control={groupForm.control} name={`activities.${index}.clustersOrJabas`} render={({ field: formField }) => (
                                            <div className="relative">
                                                <Input type="number" {...formField} className="w-24 h-8" />
                                            </div>
                                        )} />
                                    </TableCell>}
                                    <TableCell>
                                        <FormField control={groupForm.control} name={`activities.${index}.personnelCount`} render={({ field: formField }) => (
                                            <div className="relative">
                                                <Input type="number" {...formField} className="w-20 h-8" />
                                            </div>
                                        )} />
                                    </TableCell>
                                    <TableCell>
                                        <FormField control={groupForm.control} name={`activities.${index}.workdayCount`} render={({ field: formField }) => (
                                            <div className="relative">
                                                <Input type="number" {...formField} className="w-20 h-8" />
                                            </div>
                                        )} />
                                    </TableCell>
                                    <TableCell>
                                        <FormField control={groupForm.control} name={`activities.${index}.minRange`} render={({ field: formField }) => (
                                            <div className="relative">
                                                <Input type="number" {...formField} className="w-20 h-8" />
                                            </div>
                                        )} />
                                    </TableCell>
                                    <TableCell>
                                        <FormField control={groupForm.control} name={`activities.${index}.maxRange`} render={({ field: formField }) => (
                                            <div className="relative">
                                                <Input type="number" {...formField} className="w-20 h-8" />
                                            </div>
                                        )} />
                                    </TableCell>
                                    <TableCell>
                                        <FormField control={groupForm.control} name={`activities.${index}.observations`} render={({ field: formField }) => (
                                            <div className="relative">
                                                <Input {...formField} className="w-36 h-8" />
                                            </div>
                                        )} />
                                    </TableCell>
                                    <TableCell className="text-center print-hide">
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
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setAddActivityDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4"/> Agregar Fila
                        </Button>
                        {fields.length > 0 && (
                            <Button type="button" variant="outline" size="sm" onClick={handleCapture}>
                                <Camera className="mr-2 h-4 w-4"/> Capturar Tabla
                            </Button>
                        )}
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isPending || masterLoading || fields.length === 0}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
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
