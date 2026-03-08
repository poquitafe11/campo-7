"use client";

import { useEffect, useMemo, useTransition, useState, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { format, isValid } from 'date-fns';
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
  Tag,
  Pencil,
  Save,
  Wrench,
  FileInput,
  FileOutput,
  Camera,
} from 'lucide-react';

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
import { Calendar } from '@/components/ui/calendar';

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
      const summary = { performance: 0, personnelCount: 0, workdayCount: 0, clustersOrJabas: 0, minRange: 0, maxRange: 0, average: 0 };
      if (!activities || activities.length === 0) return summary;
      
      activities.forEach((curr: any) => {
        summary.performance += Number(curr.performance) || 0;
        summary.clustersOrJabas += Number(curr.clustersOrJabas) || 0;
        summary.personnelCount += Number(curr.personnelCount) || 0;
        summary.workdayCount += Number(curr.workdayCount) || 0;
        
        const min = Number(curr.minRange) || 0;
        const max = Number(curr.maxRange) || 0;
        
        if (min > 0) {
          summary.minRange = summary.minRange === 0 ? min : Math.min(summary.minRange, min);
        }
        if (max > 0) {
          summary.maxRange = Math.max(summary.maxRange, max);
        }
      });
      
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

export default function CreateActivityPage() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { labors, lotes, asistentes, presupuestos, minMax, loading: masterLoading } = useMasterData();
  const { setActions } = useHeaderActions();
  const [formMode, setFormMode] = useState<'individual' | 'group'>('individual');
  
  const [isAddActivityDialogOpen, setIsAddActivityDialogOpen] = useState(false);
  const [groupActivities, setGroupActivities] = useState<AssistantInGroup[]>([]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

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
  
  const uniqueLotes = useMemo(() => {
    const map = new Map<string, LoteData>();
    lotes.forEach(lote => {
      if (!map.has(lote.lote)) {
        map.set(lote.lote, lote);
      }
    });
    return Array.from(map.values());
  }, [lotes]);

  useEffect(() => {
    if (codeValue) {
      const matchedLabor = labors.find(l => String(l.codigo) === String(codeValue));
      const label = matchedLabor?.descripcion || '';
      if (formMode === 'individual') {
        singleForm.setValue('labor', label, { shouldValidate: true });
      } else {
        headerForm.setValue('labor', label, { shouldValidate: true });
      }
    } else {
      if (formMode === 'individual') {
        singleForm.setValue('labor', '', { shouldValidate: true });
      } else {
        headerForm.setValue('labor', '', { shouldValidate: true });
      }
    }
  }, [codeValue, labors, formMode, singleForm, headerForm]);

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

  const handleCaptureTable = async () => {
    if (!tableRef.current || groupActivities.length === 0) return;
    
    try {
      // Dynamic import to avoid build errors if the module is resolved differently in various environments
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });
      const link = document.createElement('a');
      const dateStr = format(new Date(), 'ddMMyy_HHmm');
      link.download = `Resumen_Grupal_${dateStr}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Captura Guardada", description: "La imagen se ha descargado correctamente." });
    } catch (e) {
      console.error("Error capturing table:", e);
      toast({ variant: 'destructive', title: 'Error al capturar', description: "No se pudo generar la imagen de la tabla." });
    }
  };

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

        const currentPresupuesto = presupuestos.find(p => p.lote === loteData.lote && p.descripcionLabor === data.labor && p.campana === data.campaign);
        const currentMinMax = minMax.find(mm => mm.lote === loteData.lote && mm.labor === data.labor && mm.campana === data.campaign && mm.pasada === data.pass);

        const dataToSave = {
            ...data,
            lote: loteData.lote,
            variedad: loteData.variedad,
            budgetJrnHa: currentPresupuesto?.jrnHa || 0,
            minEstablished: currentMinMax?.min || 0,
            maxEstablished: currentMinMax?.max || 0,
            registerDate: Timestamp.fromDate(data.registerDate),
            createdBy: profile.email,
            assistantDni: data.assistantDni || profile.dni || 'N/A',
            assistantName: data.assistantName || profile.nombre || 'N/A',
            createdAt: serverTimestamp(),
        };

        try {
            await addDoc(collection(db, 'actividades'), dataToSave);
            toast({ title: 'Éxito', description: 'Ficha de actividad guardada correctamente.' });
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
              pass: (data.pass || 0),
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

    const currentPresupuesto = presupuestos.find(p => p.lote === loteNumber && p.descripcionLabor === validHeaderData.labor && p.campana === validHeaderData.campaign);
    const currentMinMax = minMax.find(mm => mm.lote === loteNumber && mm.labor === validHeaderData.labor && mm.campana === validHeaderData.campaign && mm.pasada === validHeaderData.pass);

    startTransition(async () => {
        let successCount = 0;
        for (const activity of groupActivities) {
            try {
                const fullActivityData = {
                    ...validHeaderData,
                    variedad: loteData.variedad,
                    budgetJrnHa: currentPresupuesto?.jrnHa || 0,
                    minEstablished: currentMinMax?.min || 0,
                    maxEstablished: currentMinMax?.max || 0,
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
            toast({ title: 'Éxito', description: `${successCount} fichas de actividad han sido guardadas.` });
            headerForm.reset({
              registerDate: validHeaderData.registerDate, campaign: validHeaderData.campaign, stage: validHeaderData.stage, lote: '',
              code: '', labor: '', shift: validHeaderData.shift, pass: validHeaderData.pass, cost: validHeaderData.cost,
            });
            setGroupActivities([]);
        } else {
            toast({
                variant: "destructive",
                title: 'Error Parcial',
                description: `Se guardaron ${successCount} de ${groupActivities.length} fichas.`,
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
          <FormItem><FormLabel htmlFor="registerDate-header"><IconWrapper><CalendarIcon className="h-4 w-4" />Fecha de Registro</IconWrapper></FormLabel>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild><FormControl><Button id="registerDate-header" name="registerDate-header" variant={"outline"} className={cn("w-full justify-start pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value && isValid(field.value) ? format(field.value, "d 'de' MMMM 'de' yyyy", { locale: es }) : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={field.value} 
                  onSelect={(date) => {
                    field.onChange(date);
                    setIsCalendarOpen(false);
                  }} 
                  initialFocus 
                  locale={es} 
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-3 gap-4">
          <FormField control={formInstance.control} name="campaign" render={({ field }) => (
            <FormItem><FormLabel htmlFor="campaign-header"><IconWrapper><Briefcase/>Campaña</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="campaign-header" name="campaign-header"><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select><FormMessage/></FormItem>
          )}/>
          <FormField control={formInstance.control} name="stage" render={({ field }) => (
            <FormItem><FormLabel htmlFor="stage-header"><IconWrapper><Flame/>Etapa</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="stage-header" name="stage-header"><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="formacion">Formacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select><FormMessage/></FormItem>
          )}/>
          <FormField control={formInstance.control} name="lote" render={({ field }) => (
            <FormItem><FormLabel htmlFor="lote-header"><IconWrapper><Sprout/>Lote</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="lote-header" name="lote-header"><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.id}>{lote.lote}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
          )}/>
      </div>
       <div className="grid grid-cols-2 gap-4">
        <FormField control={formInstance.control} name="code" render={({ field }) => (
          <FormItem><FormLabel htmlFor="code-header"><IconWrapper><Tag/>Cód.</IconWrapper></FormLabel><FormControl><Input id="code-header" name="code-header" placeholder="Ej: 1001" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>
        )}/>
        <FormField control={formInstance.control} name="labor" render={({ field }) => (
          <FormItem><FormLabel htmlFor="labor-header"><IconWrapper><Wrench/>Labor</IconWrapper></FormLabel><FormControl><Input id="labor-header" name="labor-header" placeholder="Labor (auto-completado)" {...field} readOnly /></FormControl><FormMessage/></FormItem>
        )}/>
      </div>
       <div className="grid grid-cols-3 md:grid-cols-3 gap-x-4 gap-y-6">
          <FormField control={formInstance.control} name="cost" render={({ field }) => (<FormItem><FormLabel htmlFor="cost-header"><IconWrapper><Calculator className="h-4 w-4"/>S/ Costo (PEN)</IconWrapper></FormLabel><FormControl><Input id="cost-header" name="cost-header" type="number" placeholder='0' {...field} /></FormControl><FormMessage/></FormItem>)}/>
          <FormField control={formInstance.control} name="shift" render={({ field }) => (
              <FormItem><FormLabel htmlFor="shift-header"><IconWrapper><Clock className="h-4 w-4"/>Turno</IconWrapper></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger id="shift-header" name="shift-header"><SelectValue placeholder="Selecc."/></SelectTrigger></FormControl>
                      <SelectContent>
                          <SelectItem value="Mañana">Mañana</SelectItem>
                          <SelectItem value="Tarde">Tarde</SelectItem>
                          <SelectItem value="Noche">Noche</SelectItem>
                      </SelectContent>
                  </Select>
              <FormMessage/></FormItem>
          )}/>
          <FormField control={formInstance.control} name="pass" render={({ field }) => (<FormItem><FormLabel htmlFor="pass-header"><IconWrapper><RotateCw className="h-4 w-4"/>Pasada</IconWrapper></FormLabel><FormControl><Input id="pass-header" name="pass-header" type="number" placeholder='0' {...field} /></FormControl><FormMessage/></FormItem>)}/>
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
                  <FormField control={singleForm.control} name="registerDate" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="registerDate-single"><IconWrapper><CalendarIcon className="h-4 w-4"/>Fecha de Registro</IconWrapper></FormLabel>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild><FormControl><Button id="registerDate-single" name="registerDate-single" variant={"outline"} className={cn("w-full justify-start pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value && isValid(field.value) ? format(field.value, "d 'de' MMMM 'de' yyyy", { locale: es }) : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar 
                            mode="single" 
                            selected={field.value} 
                            onSelect={(date) => {
                              field.onChange(date);
                              setIsCalendarOpen(false);
                            }} 
                            initialFocus 
                            locale={es} 
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage/></FormItem>
                  )}/>

                  <div className="grid grid-cols-3 md:grid-cols-3 gap-x-4 gap-y-6">
                      <FormField control={singleForm.control} name="campaign" render={({ field }) => (<FormItem><FormLabel htmlFor="campaign-single"><IconWrapper><Briefcase className="h-4 w-4"/>Campaña</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="campaign-single" name="campaign-single"><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
                      <FormField control={singleForm.control} name="stage" render={({ field }) => (<FormItem><FormLabel htmlFor="stage-single"><IconWrapper><Flame className="h-4 w-4"/>Etapa</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="stage-single" name="stage-single"><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="formacion">Formacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
                      <FormField control={singleForm.control} name="lote" render={({ field }) => (<FormItem><FormLabel htmlFor="lote-single"><IconWrapper><Sprout className="h-4 w-4"/>Lote</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="lote-single" name="lote-single"><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.id}>{lote.lote}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-2 gap-x-2 gap-y-4">
                      <FormField control={singleForm.control} name="code" render={({ field }) => (<FormItem><FormLabel htmlFor="code-single"><IconWrapper><Tag className="h-4 w-4"/>Cód.</IconWrapper></FormLabel><FormControl><Input id="code-single" name="code-single" placeholder="Ej: 1001" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>)}/>
                      <FormField control={singleForm.control} name="labor" render={({ field }) => (<FormItem><FormLabel htmlFor="labor-single"><IconWrapper><Wrench className="h-4 w-4"/>Labor</IconWrapper></FormLabel><FormControl><Input id="labor-single" name="labor-single" placeholder="Labor (auto-completado)" {...field} readOnly /></FormControl><FormMessage/></FormItem>)}/>
                  </div>
                  
                   <div className="grid grid-cols-3 md:grid-cols-3 gap-x-4 gap-y-6">
                        <FormField control={singleForm.control} name="performance" render={({ field }) => ( <FormItem><FormLabel htmlFor="performance-single"><IconWrapper><TrendingUp className="h-4 w-4"/>{performanceLabel}</IconWrapper></FormLabel><FormControl><Input id="performance-single" name="performance-single" type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        {showExtraPerformanceField && (<FormField control={singleForm.control} name="clustersOrJabas" render={({ field }) => (<FormItem><FormLabel htmlFor="clustersOrJabas-single"><IconWrapper><ExtraPerformanceIcon className="h-4 w-4" />{extraPerformanceLabel}</IconWrapper></FormLabel><FormControl><Input id="clustersOrJabas-single" name="clustersOrJabas-single" type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/> )}
                         <FormField control={singleForm.control} name="personnelCount" render={({ field }) => (<FormItem><FormLabel htmlFor="personnelCount-single"><IconWrapper><Users className="h-4 w-4"/># Peronas</IconWrapper></FormLabel><FormControl><Input id="personnelCount-single" name="personnelCount-single" type="number" placeholder="1" {...field}  /></FormControl><FormMessage/></FormItem>)}/>
                        <FormField control={singleForm.control} name="workdayCount" render={({ field }) => (<FormItem><FormLabel htmlFor="workdayCount-single"><IconWrapper><ClipboardList className="h-4 w-4"/># Jornadas (JHU)</IconWrapper></FormLabel><FormControl><Input id="workdayCount-single" name="workdayCount-single" type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                    </div>
                    
                     <div className="grid grid-cols-3 md:grid-cols-3 gap-x-4 gap-y-6">
                         <FormField control={singleForm.control} name="cost" render={({ field }) => (<FormItem><FormLabel htmlFor="cost-single"><IconWrapper><Calculator className="h-4 w-4"/>S/ Costo (PEN)</IconWrapper></FormLabel><FormControl><Input id="cost-single" name="cost-single" type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                         <FormField control={singleForm.control} name="shift" render={({ field }) => (<FormItem><FormLabel htmlFor="shift-single"><IconWrapper><Clock className="h-4 w-4"/>Turno</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger id="shift-single" name="shift-single"><SelectValue placeholder="Selecc."/></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem><SelectItem value="Noche">Noche</SelectItem></SelectContent></Select><FormMessage/></FormItem>)}/>
                         <FormField control={singleForm.control} name="pass" render={({ field }) => (<FormItem><FormLabel htmlFor="pass-single"><IconWrapper><RotateCw className="h-4 w-4"/>Pasada</IconWrapper></FormLabel><FormControl><Input id="pass-single" name="pass-single" type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                     </div>
                      
                     <div className="grid grid-cols-2 md:grid-cols-2 gap-x-4 gap-y-6">
                         <FormField control={singleForm.control} name="minRange" render={({ field }) => (<FormItem><FormLabel htmlFor="minRange-single"><IconWrapper><FileInput className="h-4 w-4"/>Min</IconWrapper></FormLabel><FormControl><Input id="minRange-single" name="minRange-single" type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                         <FormField control={singleForm.control} name="maxRange" render={({ field }) => (<FormItem><FormLabel htmlFor="maxRange-single"><IconWrapper><FileOutput className="h-4 w-4"/>Max</IconWrapper></FormLabel><FormControl><Input id="maxRange-single" name="maxRange-single" type="number" placeholder="0" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                     </div>
                      
                     <FormField control={singleForm.control} name="observations" render={({ field }) => ( <FormItem><FormLabel htmlFor="observations-single"><IconWrapper><Pencil className="h-4 w-4"/>Observaciones</IconWrapper></FormLabel> <FormControl><Textarea id="observations-single" name="observations-single" placeholder="Escribe aquí tus observaciones..." {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
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
                    
                    <div className="overflow-x-auto" ref={tableRef}>
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
                                    <TableHead className="w-[80px] text-center">Acciones</TableHead>
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
                                                <Input id={`perf-${index}`} name={`perf-${index}`} aria-label={`Rendimiento para ${field.assistantName}`} type="number" value={field.performance || ''} onChange={e => handleGroupActivityChange(index, 'performance', e.target.value)} className="w-24 h-8" />
                                            </TableCell>
                                            {showExtraPerformanceField && <TableCell>
                                            <Input id={`clusters-${index}`} name={`clusters-${index}`} aria-label={`${extraPerformanceLabel} para ${field.assistantName}`} type="number" value={field.clustersOrJabas || ''} onChange={e => handleGroupActivityChange(index, 'clustersOrJabas', e.target.value)} className="w-24 h-8" />
                                            </TableCell>}
                                            <TableCell>
                                                <Input id={`pers-${index}`} name={`pers-${index}`} aria-label={`# Personas para ${field.assistantName}`} type="number" value={field.personnelCount || ''} onChange={e => handleGroupActivityChange(index, 'personnelCount', e.target.value)} className="w-20 h-8" />
                                            </TableCell>
                                            <TableCell>
                                                <Input id={`jhu-${index}`} name={`jhu-${index}`} aria-label={`# Jornadas para ${field.assistantName}`} type="number" value={field.workdayCount || ''} onChange={e => handleGroupActivityChange(index, 'workdayCount', e.target.value)} className="w-20 h-8" />
                                            </TableCell>
                                            <TableCell>
                                                <Input id={`avg-${index}`} name={`avg-${index}`} aria-label={`Promedio para ${field.assistantName}`} type="number" value={average.toFixed(2)} readOnly disabled className="w-20 h-8 bg-muted/50" />
                                            </TableCell>
                                            <TableCell>
                                                <Input id={`min-${index}`} name={`min-${index}`} aria-label={`Mínimo para ${field.assistantName}`} type="number" value={field.minRange || ''} onChange={e => handleGroupActivityChange(index, 'minRange', e.target.value)} className="w-20 h-8" />
                                            </TableCell>
                                            <TableCell>
                                                <Input id={`max-${index}`} name={`max-${index}`} aria-label={`Máximo para ${field.assistantName}`} type="number" value={field.maxRange || ''} onChange={e => handleGroupActivityChange(index, 'maxRange', e.target.value)} className="w-20 h-8" />
                                            </TableCell>
                                            <TableCell>
                                                <Input id={`obs-${index}`} name={`obs-${index}`} aria-label={`Observaciones para ${field.assistantName}`} value={field.observations || ''} onChange={e => handleGroupActivityChange(index, 'observations', e.target.value)} className="w-36 h-8" />
                                            </TableCell>
                                            <TableCell className="text-center">
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
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsAddActivityDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4"/> Agregar Fila
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleCaptureTable} disabled={groupActivities.length === 0}>
                            <Camera className="mr-2 h-4 w-4"/> Tomar Captura
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
          setIsOpen={setIsAddActivityDialogOpen}
          onSelectAssistant={handleAddAssistant}
          currentAssistantsDnis={groupActivities.map(f => f.assistantDni)}
       />
    </>
  );
}