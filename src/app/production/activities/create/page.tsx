
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

// --- Componentes Auxiliares fuera para evitar errores de anidamiento ---

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

function CaptureReport({ 
  activities, 
  header, 
  showExtraPerformanceField, 
  performanceLabel, 
  extraPerformanceLabel,
  loteLabel,
  responsableName
}: { 
  activities: AssistantInGroup[], 
  header: any, 
  showExtraPerformanceField: boolean,
  performanceLabel: string,
  extraPerformanceLabel: string,
  loteLabel: string,
  responsableName: string
}) {
  const totals = {
    performance: activities.reduce((sum, a) => sum + (Number(a.performance) || 0), 0),
    extra: activities.reduce((sum, a) => sum + (Number(a.clustersOrJabas) || 0), 0),
    jhu: activities.reduce((sum, a) => sum + (Number(a.workdayCount) || 0), 0),
  };

  const numerator = showExtraPerformanceField ? totals.extra : totals.performance;
  const grandAverage = totals.jhu > 0 ? numerator / totals.jhu : 0;

  return (
    <div className="bg-white p-8 text-black font-sans border-2 border-black" style={{ width: '1000px' }}>
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold border-b-2 border-black pb-1 uppercase">REPORTE DE CAMPO - FICHA DE ACTIVIDAD</h2>
          <p className="text-sm"><strong>FECHA:</strong> {header.registerDate ? format(header.registerDate, "d 'de' MMMM, yyyy", { locale: es }) : '---'}</p>
          <p className="text-sm"><strong>LABOR:</strong> {header.labor || '---'} ({header.code || '---'})</p>
          <p className="text-sm"><strong>LOTE:</strong> {loteLabel || '---'} | <strong>PASADA:</strong> {header.pass || '0'}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold bg-gray-100 p-2 border border-black inline-block">RESPONSABLE: {responsableName || '---'}</p>
          <p className="text-xs text-gray-500 mt-1 italic">Generado el {format(new Date(), 'Pp', { locale: es })}</p>
        </div>
      </div>

      <table className="w-full border-collapse border-2 border-black text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-2 text-left">ASISTENTE / ENCARGADO</th>
            <th className="border border-black p-2 text-center w-24">{performanceLabel}</th>
            {showExtraPerformanceField && <th className="border border-black p-2 text-center w-24">{extraPerformanceLabel}</th>}
            <th className="border border-black p-2 text-center w-20">JHU</th>
            <th className="border border-black p-2 text-center w-24">PROMEDIO</th>
            <th className="border border-black p-2 text-center w-20">MIN</th>
            <th className="border border-black p-2 text-center w-20">MAX</th>
            <th className="border border-black p-2 text-left">OBSERVACIONES</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act) => {
            const num = showExtraPerformanceField ? (Number(act.clustersOrJabas) || 0) : (Number(act.performance) || 0);
            const avg = (Number(act.workdayCount) || 0) > 0 ? num / Number(act.workdayCount) : 0;
            return (
              <tr key={act.id}>
                <td className="border border-black p-2 font-medium">{act.assistantName}</td>
                <td className="border border-black p-2 text-center">{Number(act.performance || 0).toLocaleString('es-PE')}</td>
                {showExtraPerformanceField && <td className="border border-black p-2 text-center">{Number(act.clustersOrJabas || 0).toLocaleString('es-PE')}</td>}
                <td className="border border-black p-2 text-center font-bold">{Number(act.workdayCount || 0).toFixed(1)}</td>
                <td className="border border-black p-2 text-center bg-blue-50">{avg.toFixed(2)}</td>
                <td className="border border-black p-2 text-center text-red-600">{Number(act.minRange || 0)}</td>
                <td className="border border-black p-2 text-center text-blue-600">{Number(act.maxRange || 0)}</td>
                <td className="border border-black p-2 text-xs">{act.observations || '---'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-100 font-bold border-t-2 border-black">
          <tr>
            <td className="border border-black p-2 text-right">TOTAL GENERAL</td>
            <td className="border border-black p-2 text-center">{totals.performance.toLocaleString('es-PE')}</td>
            {showExtraPerformanceField && <td className="border border-black p-2 text-center">{totals.extra.toLocaleString('es-PE')}</td>}
            <td className="border border-black p-2 text-center text-primary">{totals.jhu.toFixed(1)}</td>
            <td className="border border-black p-2 text-center bg-blue-100">{grandAverage.toFixed(2)}</td>
            <td colSpan={3} className="border border-black p-2 bg-white"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// --- Componente Principal ---

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
  
  const reportRef = useRef<HTMLDivElement>(null);

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
    if (!reportRef.current || groupActivities.length === 0) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      reportRef.current.style.display = 'block';
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });
      reportRef.current.style.display = 'none';
      const link = document.createElement('a');
      const dateStr = format(new Date(), 'ddMMyy_HHmm');
      link.download = `Resumen_Grupal_${dateStr}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Captura Guardada", description: "Reporte profesional generado correctamente." });
    } catch (e) {
      console.error("Error capturing table:", e);
      toast({ variant: 'destructive', title: 'Error al capturar', description: "No se pudo generar la imagen del reporte." });
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
                    performance: Number(activity.performance) || 0,
                    clustersOrJabas: Number(activity.clustersOrJabas) || 0,
                    personnelCount: Number(activity.personnelCount) || 0,
                    workdayCount: Number(activity.workdayCount) || 0,
                    minRange: Number(activity.minRange) || 0,
                    maxRange: Number(activity.maxRange) || 0,
                    observations: activity.observations || '',
                    createdAt: serverTimestamp(),
                };
                await addDoc(collection(db, 'actividades'), fullActivityData);
                successCount++;
            } catch(error: any) {
                 console.error("Error saving group activity: ", error);
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

  const renderSharedHeader = (formInstance: any, isSingle: boolean) => {
    const prefix = isSingle ? 'single' : 'header';
    return (
      <div className="space-y-6">
        <FormField control={formInstance.control} name="registerDate" render={({ field }) => (
            <FormItem><FormLabel htmlFor={`${prefix}-registerDate`}><IconWrapper><CalendarIcon className="h-4 w-4" />Fecha de Registro</IconWrapper></FormLabel>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild><FormControl><Button id={`${prefix}-registerDate`} name={`${prefix}-registerDate`} variant={"outline"} className={cn("w-full justify-start pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value && isValid(field.value) ? format(field.value, "d 'de' MMMM 'de' yyyy", { locale: es }) : <span>Elige una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={field.value} onSelect={(date) => { field.onChange(date); setIsCalendarOpen(false); }} initialFocus locale={es} />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-4">
            <FormField control={formInstance.control} name="campaign" render={({ field }) => (
              <FormItem><FormLabel htmlFor={`${prefix}-campaign`}><IconWrapper><Briefcase/>Campaña</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id={`${prefix}-campaign`} name={`${prefix}-campaign`}><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select><FormMessage/></FormItem>
            )}/>
            <FormField control={formInstance.control} name="stage" render={({ field }) => (
              <FormItem><FormLabel htmlFor={`${prefix}-stage`}><IconWrapper><Flame/>Etapa</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id={`${prefix}-stage`} name={`${prefix}-stage`}><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="formacion">Formacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select><FormMessage/></FormItem>
            )}/>
            <FormField control={formInstance.control} name="lote" render={({ field }) => (
              <FormItem><FormLabel htmlFor={`${prefix}-lote`}><IconWrapper><Sprout/>Lote</IconWrapper></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id={`${prefix}-lote`} name={`${prefix}-lote`}><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.id}>{lote.lote}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>
            )}/>
        </div>
         <div className="grid grid-cols-2 gap-4">
          <FormField control={formInstance.control} name="code" render={({ field }) => (
            <FormItem><FormLabel htmlFor={`${prefix}-code`}><IconWrapper><Tag/>Cód.</IconWrapper></FormLabel><FormControl><Input id={`${prefix}-code`} name={`${prefix}-code`} placeholder="Ej: 31" {...field} value={field.value || ''} /></FormControl><FormMessage/></FormItem>
          )}/>
          <FormField control={formInstance.control} name="labor" render={({ field }) => (
            <FormItem><FormLabel htmlFor={`${prefix}-labor`}><IconWrapper><Wrench/>Labor</IconWrapper></FormLabel><FormControl><Input id={`${prefix}-labor`} name={`${prefix}-labor`} placeholder="Labor..." {...field} readOnly /></FormControl><FormMessage/></FormItem>
          )}/>
        </div>
         <div className="grid grid-cols-3 gap-4">
            <FormField control={formInstance.control} name="cost" render={({ field }) => (<FormItem><FormLabel htmlFor={`${prefix}-cost`}><IconWrapper><Calculator className="h-4 w-4"/>S/ Costo</IconWrapper></FormLabel><FormControl><Input id={`${prefix}-cost`} name={`${prefix}-cost`} type="number" {...field} /></FormControl><FormMessage/></FormItem>)}/>
            <FormField control={formInstance.control} name="shift" render={({ field }) => (
                <FormItem><FormLabel htmlFor={`${prefix}-shift`}><IconWrapper><Clock className="h-4 w-4"/>Turno</IconWrapper></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger id={`${prefix}-shift`} name={`${prefix}-shift`}><SelectValue placeholder="Selecc."/></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem></SelectContent>
                    </Select>
                <FormMessage/></FormItem>
            )}/>
            <FormField control={formInstance.control} name="pass" render={({ field }) => (<FormItem><FormLabel htmlFor={`${prefix}-pass`}><IconWrapper><RotateCw className="h-4 w-4"/>Pasada</IconWrapper></FormLabel><FormControl><Input id={`${prefix}-pass`} name={`${prefix}-pass`} type="number" {...field} /></FormControl><FormMessage/></FormItem>)}/>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-center space-x-2 mb-6">
          <Label htmlFor="form-mode-switch">Individual</Label>
          <Switch id="form-mode-switch" checked={formMode === 'group'} onCheckedChange={(checked) => setFormMode(checked ? 'group' : 'individual')} />
          <Label htmlFor="form-mode-switch">Grupal</Label>
      </div>

      {formMode === 'individual' ? (
        <Form {...singleForm}>
           <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-6">
              <div className="rounded-lg border bg-card p-6 shadow-sm">
                {renderSharedHeader(singleForm, true)}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <FormField control={singleForm.control} name="performance" render={({ field }) => ( <FormItem><FormLabel>{performanceLabel}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                    {showExtraPerformanceField && (<FormField control={singleForm.control} name="clustersOrJabas" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2"><ExtraPerformanceIcon className="h-4 w-4" />{extraPerformanceLabel}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>)}/> )}
                    <FormField control={singleForm.control} name="personnelCount" render={({ field }) => (<FormItem><FormLabel># Peronas</FormLabel><FormControl><Input type="number" {...field}  /></FormControl><FormMessage/></FormItem>)}/>
                    <FormField control={singleForm.control} name="workdayCount" render={({ field }) => (<FormItem><FormLabel># Jornadas</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                    <FormField control={singleForm.control} name="minRange" render={({ field }) => (<FormItem><FormLabel>Mínimo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>)}/>
                    <FormField control={singleForm.control} name="maxRange" render={({ field }) => (<FormItem><FormLabel>Máximo</FormLabel><FormControl>
