

"use client";

import { useEffect, useMemo, useTransition, useState, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from 'react-hook-form';
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


import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ActivityRecordSchema, type LoteData } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useMasterData } from '@/context/MasterDataContext';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AddAssistantActivityDialog from '@/components/AddAssistantActivityDialog';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';


const Calendar = dynamic(() => import('@/components/ui/calendar').then(mod => mod.Calendar), {
  ssr: false,
  loading: () => <div className="h-[290px] w-[240px] bg-muted rounded-md animate-pulse" />,
});


type SingleActivityFormValues = z.infer<typeof ActivityRecordSchema>;

const assistantInGroupSchema = z.object({
  id: z.string(),
  assistantDni: z.string(),
  assistantName: z.string(),
  performance: z.coerce.number().optional(),
  clustersOrJabas: z.coerce.number().optional(),
  personnelCount: z.coerce.number().int().optional(),
  workdayCount: z.coerce.number().optional(),
  minRange: z.coerce.number().optional(),
  maxRange: z.coerce.number().optional(),
  observations: z.string().optional(),
});
type AssistantInGroup = z.infer<typeof assistantInGroupSchema>;

const headerSchema = ActivityRecordSchema.pick({
    registerDate: true,
    campaign: true,
    stage: true,
    lote: true,
    code: true,
    labor: true,
    shift: true,
    pass: true,
    cost: true,
});

type HeaderFormValues = z.infer<typeof headerSchema>;


const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">{children}</div>
);

function GroupFormTotals({ activities, showExtraPerformanceField }: { activities: AssistantInGroup[], showExtraPerformanceField: boolean }) {
  
    const totals = useMemo(() => {
      if (!activities || activities.length === 0) return { performance: 0, personnelCount: 0, workdayCount: 0, clustersOrJabas: 0, minRange: 0, maxRange: 0, average: 0 };
      
      const summary = activities.reduce((acc: any, curr: any) => {
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
      
      const numerator = showExtraPerformanceField ? summary.clustersOrJabas : summary.performance;
      summary.average = summary.workdayCount > 0 ? numerator / summary.workdayCount : 0;
      
      return summary;
    }, [activities, showExtraPerformanceField]);

    return (
      <TableRow>
        <TableCell colSpan={1} className="font-bold text-right">Total</TableCell>
        <TableCell className="font-bold text-center">{totals.performance.toLocaleString('es-PE')}</TableCell>
        {showExtraPerformanceField && <TableCell className="font-bold text-center">{totals.clustersOrJabas.toLocaleString('es-PE')}</TableCell>}
        <TableCell className="font-bold text-center">{totals.personnelCount}</TableCell>
        <TableCell className="font-bold text-center">{totals.workdayCount.toFixed(1)}</TableCell>
        <TableCell className="font-bold text-center">{totals.average.toFixed(2)}</TableCell>
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
  
  const [isAddActivityDialogOpen, setAddActivityDialogOpen] = useState(false);
  const [groupActivities, setGroupActivities] = useState<AssistantInGroup[]>([]);

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
      assistantName: '',
      createdBy: '',
    },
  });

  const headerForm = useForm<HeaderFormValues>({
    resolver: zodResolver(headerSchema),
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
    }
  });

  
  useEffect(() => {
    if (formMode === 'individual' && profile) {
        singleForm.reset({
          registerDate: new Date(),
          campaign: '', stage: '', lote: '', code: '', labor: '',
          performance: 0, clustersOrJabas: 0, personnelCount: 1, workdayCount: 0,
          cost: 0, shift: '', minRange: 0, maxRange: 0, pass: 0,
          observations: '',
          assistantDni: profile.dni || '',
          assistantName: profile.nombre || '',
          createdBy: profile.email || '',
        });
    } else {
        headerForm.reset({
          registerDate: new Date(), campaign: '', stage: '', lote: '',
          code: '', labor: '', shift: '', pass: 0, cost: 0,
        });
        setGroupActivities([]);
    }
  }, [formMode, singleForm, headerForm, profile]);

  
  const singleCodeValue = useWatch({ control: singleForm.control, name: 'code' });
  const headerCodeValue = useWatch({ control: headerForm.control, name: 'code' });
  
  const codeValue = formMode === 'individual' ? singleCodeValue : headerCodeValue;
  const activeForm = formMode === 'individual' ? singleForm : headerForm;
  
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
    if (profile?.email) {
      singleForm.setValue('createdBy', profile.email);
    }
     if (profile) {
       singleForm.setValue('assistantDni', profile.dni || '');
       singleForm.setValue('assistantName', profile.nombre || '');
    }
  }, [profile, singleForm]);
  
  const showExtraPerformanceField = useMemo(() => ['46', '67'].includes(String(codeValue) || ''), [codeValue]);
  const performanceLabel = showExtraPerformanceField ? "Rdto (Plta)" : "Rdto";
  const extraPerformanceLabel = String(codeValue) === '46' ? "Racimos" : "Jabas";
  const ExtraPerformanceIcon = String(codeValue) === '46' ? Grape : Boxes;

  const onSingleSubmit = (data: SingleActivityFormValues) => {
    if (!profile?.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario.' });
      return;
    }
    
    startTransition(async () => {
        const loteId = data.lote;
        const loteData = lotes.find(l => l.id === loteId);
        if (!loteData) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el lote seleccionado.' });
            return;
        }

        const dataToSave = {
            ...data,
            lote: loteData.lote,
            registerDate: Timestamp.fromDate(data.registerDate),
            createdBy: profile.email,
            assistantDni: profile.dni || 'N/A',
            assistantName: profile.nombre || 'N/A',
            createdAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(db, 'actividades'), dataToSave);
            toast({
                title: 'Éxito',
                description: 'Ficha de actividad guardada correctamente.',
            });
            singleForm.reset({
              ...singleForm.getValues(),
              code: '',
              labor: '',
              performance: 0,
              clustersOrJabas: 0,
              personnelCount: 1,
              workdayCount: 0,
              minRange: 0,
              maxRange: 0,
              pass: 0,
              observations: '',
            });
        } catch(error: any) {
            console.error("Error saving activity: ", error);
             toast({
                variant: 'destructive',
                title: 'Error al Guardar',
                description: error.message || 'No se pudo guardar la ficha.',
            });
        }
    });
  };
  
 const handleGroupSave = async () => {
    const isValidHeader = await headerForm.trigger();
    if (!isValidHeader) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, complete todos los campos de la cabecera.' });
      return;
    }

    if (groupActivities.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debe agregar al menos una fila de asistente.' });
        return;
    }
    
    if (!profile?.email) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo identificar al usuario.' });
        return;
    }

    const validHeaderData = headerForm.getValues();
    const loteId = validHeaderData.lote;
    const loteData = lotes.find(l => l.id === loteId);
    
    if (!loteData) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el lote seleccionado.' });
        return;
    }
    const loteNumber = loteData.lote;

    startTransition(async () => {
        let successCount = 0;
        for (const activity of groupActivities) {
            try {
                const fullActivityData = {
                    ...validHeaderData,
                    registerDate: Timestamp.fromDate(validHeaderData.registerDate),
                    lote: loteNumber,
                    createdBy: profile.email,
                    assistantDni: activity.assistantDni,
                    assistantName: activity.assistantName,
                    performance: activity.performance || 0,
                    clustersOrJabas: activity.clustersOrJabas || 0,
                    personnelCount: activity.personnelCount || 0,
                    workdayCount: activity.workdayCount || 0,
                    minRange: activity.minRange || 0,
                    maxRange: activity.maxRange || 0,
                    observations: activity.observations || '',
                    createdAt: serverTimestamp(),
                };
                await addDoc(collection(db, 'actividades'), fullActivityData);
                successCount++;
            } catch(error: any) {
                 console.error("Error saving group activity: ", error);
                 toast({
                    variant: 'destructive',
                    title: `Error guardando registro para ${activity.assistantName}`,
                    description: error.message,
                });
            }
        }

        if (successCount === groupActivities.length) {
            toast({
                title: 'Éxito',
                description: `${successCount} fichas de actividad han sido guardadas.`,
            });
            headerForm.reset({
              registerDate: new Date(), campaign: '', stage: '', lote: '',
              code: '', labor: '', shift: '', pass: 0, cost: 0,
            });
            setGroupActivities([]);
        } else {
            toast({
                variant: "destructive",
                title: 'Error Parcial',
                description: `Se guardaron ${successCount} de ${groupActivities.length} fichas. Por favor, revise los datos.`,
            });
        }
    });
};
  
  const handleAddAssistant = (assistant: { assistantDni: string, assistantName: string }) => {
    setGroupActivities(prev => [...prev, {
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
    }]);
  };

  const handleGroupActivityChange = (index: number, field: keyof AssistantInGroup, value: any) => {
    setGroupActivities(prev => {
        const newActivities = [...prev];
        const activityToUpdate = newActivities[index];
        if (activityToUpdate) {
            (activityToUpdate as any)[field] = value;
        }
        return newActivities;
    });
  };

  const handleRemoveActivity = (id: string) => {
    setGroupActivities(prev => prev.filter(act => act.id !== id));
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
            <FormItem><FormLabel><IconWrapper><Sprout/>Lote</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.id}>{lote.lote}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
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
       <div className="grid grid-cols-3 md:grid-cols-3 gap-x-4 gap-y-6">
          <FormField control={formInstance.control} name="cost" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Calculator className="h-4 w-4"/>S/ Costo (PEN)</IconWrapper></FormLabel><FormControl><Input type="number" placeholder='0' {...field} /></FormControl><FormMessage/></FormItem>)}/>
          <FormField control={formInstance.control} name="shift" render={({ field }) => (
              <FormItem><FormLabel><IconWrapper><Clock className="h-4 w-4"/>Turno</IconWrapper></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecc."/></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="Mañana">Mañana</SelectItem>
                          <SelectItem value="Tarde">Tarde</SelectItem>
                          <SelectItem value="Noche">Noche</SelectItem>
                      </SelectContent>
                  </Select>
              <FormMessage/></FormItem>
          )}/>
          <FormField control={formInstance.control} name="pass" render={({ field }) => (<FormItem><FormLabel><IconWrapper><RotateCw className="h-4 w-4"/>Pasada</IconWrapper></FormLabel><FormControl><Input type="number" placeholder='0' {...field} /></FormControl><FormMessage/></FormItem>)}/>
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
                      <FormField control={singleForm.control} name="lote" render={({ field }) => (<FormItem><FormLabel><IconWrapper><Sprout className="h-4 w-4"/>Lote</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.id}>{lote.lote}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
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
          <Form {...headerForm}>
            <form className="space-y-6">
               <div className="rounded-lg border bg-card text-card-foreground p-4 shadow-sm space-y-4">
                    {renderSharedHeader(headerForm)}
                    
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px]">Asistente</TableHead>
                                    <TableHead className="min-w-[120px]">{performanceLabel}</TableHead>
                                    {showExtraPerformanceField && <TableHead className="min-w-[120px]">{extraPerformanceLabel}</TableHead>}
                                    <TableHead className="min-w-[100px]">Personas</TableHead>
                                    <TableHead className="min-w-[100px]">JHU</TableHead>
                                    <TableHead className="min-w-[100px]">Prom.</TableHead>
                                    <TableHead className="min-w-[100px]">Mínimo</TableHead>
                                    <TableHead className="min-w-[100px]">Máximo</TableHead>
                                    <TableHead className="min-w-[150px]">Obs.</TableHead>
                                    <TableHead className="w-[80px] text-center print-hide">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupActivities.map((field, index) => {
                                    const numerator = showExtraPerformanceField ? (field.clustersOrJabas || 0) : (field.performance || 0);
                                    const average = (field.workdayCount || 0) > 0 ? (numerator / (field.workdayCount || 1)) : 0;
                                    return (
                                        <TableRow key={field.id}>
                                            <TableCell className="font-medium whitespace-nowrap">{field.assistantName}</TableCell>
                                            <TableCell>
                                                <Input type="number" value={field.performance || ''} onChange={e => handleGroupActivityChange(index, 'performance', e.target.value)} className="w-24 h-8" />
                                            </TableCell>
                                            {showExtraPerformanceField && <TableCell>
                                            <Input type="number" value={field.clustersOrJabas || ''} onChange={e => handleGroupActivityChange(index, 'clustersOrJabas', e.target.value)} className="w-24 h-8" />
                                            </TableCell>}
                                            <TableCell>
                                                <Input type="number" value={field.personnelCount || ''} onChange={e => handleGroupActivityChange(index, 'personnelCount', e.target.value)} className="w-20 h-8" />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={field.workdayCount || ''} onChange={e => handleGroupActivityChange(index, 'workdayCount', e.target.value)} className="w-20 h-8" />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={average.toFixed(2)} readOnly disabled className="w-20 h-8 bg-muted/50" />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={field.minRange || ''} onChange={e => handleGroupActivityChange(index, 'minRange', e.target.value)} className="w-20 h-8" />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={field.maxRange || ''} onChange={e => handleGroupActivityChange(index, 'maxRange', e.target.value)} className="w-20 h-8" />
                                            </TableCell>
                                            <TableCell>
                                                <Input value={field.observations || ''} onChange={e => handleGroupActivityChange(index, 'observations', e.target.value)} className="w-36 h-8" />
                                            </TableCell>
                                            <TableCell className="text-center print-hide">
                                                <div className="flex gap-1 justify-center">
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveActivity(field.id)}><Trash2 className="h-4 w-4"/></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                            <TableFooter>
                                <GroupFormTotals activities={groupActivities} showExtraPerformanceField={showExtraPerformanceField} />
                            </TableFooter>
                        </Table>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setAddActivityDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4"/> Agregar Fila
                        </Button>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="button" onClick={handleGroupSave} disabled={isPending || masterLoading || groupActivities.length === 0}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                            Guardar {groupActivities.length} Registros
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
          currentAssistantsDnis={groupActivities.map(f => f.assistantDni)}
       />
    </>
  );
}
