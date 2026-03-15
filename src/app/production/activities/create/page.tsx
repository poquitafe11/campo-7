"use client";

import { useEffect, useMemo, useTransition, useState, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  RotateCw,
  Briefcase,
  Calculator,
  Loader2,
  Boxes,
  Grape,
  PlusCircle,
  Trash2,
  Tag,
  Pencil,
  Save,
  Wrench,
  Camera,
  Clock,
  Sprout,
  Flame
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
import { Card, CardContent } from '@/components/ui/card';
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

// Componente para totales del formulario grupal
function GroupFormTotals({ activities, showExtraPerformanceField }: { activities: AssistantInGroup[], showExtraPerformanceField: boolean }) {
    const totals = useMemo(() => {
      const summary = { performance: 0, personnelCount: 0, workdayCount: 0, clustersOrJabas: 0, minRange: 0, maxRange: 0, average: 0 };
      if (!activities || activities.length === 0) return summary;
      
      activities.forEach((curr) => {
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
      <TableRow className="bg-muted/50 font-bold">
        <TableCell className="text-right">Total</TableCell>
        <TableCell className="text-center">{totals.performance.toLocaleString('es-PE')}</TableCell>
        {showExtraPerformanceField && <TableCell className="text-center">{totals.clustersOrJabas.toLocaleString('es-PE')}</TableCell>}
        <TableCell className="text-center">{totals.workdayCount.toFixed(1)}</TableCell>
        <TableCell colSpan={2}></TableCell>
      </TableRow>
    );
}

// Componente para el reporte profesional de captura
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
        <div className="space-y-1 text-left">
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

export default function CreateActivityPage() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { labors, lotes, presupuestos, minMax, loading: masterLoading } = useMasterData();
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

  const singleCodeValue = useWatch({ control: singleForm.control, name: 'code' });
  const headerCodeValue = useWatch({ control: headerForm.control, name: 'code' });
  const codeValue = formMode === 'individual' ? singleCodeValue : headerCodeValue;

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
    if (profile) {
      singleForm.setValue('createdBy', profile.email || '');
      singleForm.setValue('assistantDni', profile.dni || '');
      singleForm.setValue('assistantName', profile.nombre || '');
    }
  }, [profile, singleForm]);

  const uniqueLotes = useMemo(() => {
    const map = new Map<string, LoteData>();
    lotes.forEach(lote => {
      if (!map.has(lote.lote)) {
        map.set(lote.lote, lote);
      }
    });
    return Array.from(map.values());
  }, [lotes]);

  const showExtraPerformanceField = useMemo(() => ['46', '67'].includes(String(codeValue) || ''), [codeValue]);
  const performanceLabel = showExtraPerformanceField ? "Rdto (Plta)" : "Rendimiento";
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
      link.download = `Reporte_${format(new Date(), 'ddMMyy_HHmm')}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Captura Guardada", description: "Reporte generado correctamente." });
    } catch (e) {
      console.error("Error capturing table:", e);
      toast({ variant: 'destructive', title: 'Error al capturar', description: "No se pudo generar la imagen." });
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
            toast({ variant: 'destructive', title: 'Error', description: 'Lote no encontrado.' });
            return;
        }
        try {
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
                createdAt: serverTimestamp(),
            };
            await addDoc(collection(db, 'actividades'), dataToSave);
            toast({ title: 'Éxito', description: 'Registro guardado.' });
            singleForm.reset({ ...singleForm.getValues(), code: '', labor: '', performance: 0, workdayCount: 0, observations: '' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    });
  };

  const handleGroupSave = async () => {
    const isValidHeader = await headerForm.trigger();
    if (!isValidHeader || groupActivities.length === 0 || !profile?.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'Complete la cabecera y agregue asistentes.' });
      return;
    }
    const validHeaderData = headerForm.getValues();
    const loteData = lotes.find(l => l.id === validHeaderData.lote);
    if (!loteData) return;

    startTransition(async () => {
        let successCount = 0;
        for (const act of groupActivities) {
            try {
                const dataToSave = {
                    ...validHeaderData,
                    lote: loteData.lote,
                    variedad: loteData.variedad,
                    registerDate: Timestamp.fromDate(validHeaderData.registerDate),
                    assistantDni: act.assistantDni,
                    assistantName: act.assistantName,
                    performance: Number(act.performance) || 0,
                    clustersOrJabas: Number(act.clustersOrJabas) || 0,
                    personnelCount: Number(act.personnelCount) || 1,
                    workdayCount: Number(act.workdayCount) || 0,
                    minRange: Number(act.minRange) || 0,
                    maxRange: Number(act.maxRange) || 0,
                    observations: act.observations || '',
                    createdBy: profile.email,
                    createdAt: serverTimestamp(),
                };
                await addDoc(collection(db, 'actividades'), dataToSave);
                successCount++;
            } catch (e) {}
        }
        if (successCount > 0) {
            toast({ title: 'Éxito', description: `${successCount} registros guardados.` });
            headerForm.reset({ ...headerForm.getValues(), lote: '', code: '', labor: '' });
            setGroupActivities([]);
        }
    });
  };

  const renderSharedHeader = (formInstance: any) => {
    const prefix = formMode === 'individual' ? 'ind' : 'grp';
    return (
      <div className="space-y-4">
        <FormField control={formInstance.control} name="registerDate" render={({ field }) => (
            <FormItem className="flex flex-col"><FormLabel><IconWrapper><CalendarIcon className="h-4 w-4" />Fecha</IconWrapper></FormLabel>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild><FormControl><Button variant={"outline"} className="w-full text-left font-normal">{field.value ? format(field.value, "d 'de' MMMM, yyyy", { locale: es }) : "Elegir fecha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(d) => { field.onChange(d); setIsCalendarOpen(false); }} initialFocus locale={es}/></PopoverContent>
              </Popover>
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-2">
            <FormField control={formInstance.control} name="campaign" render={({ field }) => (
              <FormItem><FormLabel>Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select></FormItem>
            )}/>
            <FormField control={formInstance.control} name="stage" render={({ field }) => (
              <FormItem><FormLabel>Etapa</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select></FormItem>
            )}/>
            <FormField control={formInstance.control} name="lote" render={({ field }) => (
              <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.id}>{l.lote}</SelectItem>)}</SelectContent></Select></FormItem>
            )}/>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <FormField control={formInstance.control} name="code" render={({ field }) => (
            <FormItem><FormLabel><IconWrapper><Tag className="h-3 w-3"/>Cód.</IconWrapper></FormLabel><FormControl><Input placeholder="31" {...field} /></FormControl></FormItem>
          )}/>
          <FormField control={formInstance.control} name="labor" render={({ field }) => (
            <FormItem className="col-span-2"><FormLabel><IconWrapper><Wrench className="h-3 w-3"/>Labor</IconWrapper></FormLabel><FormControl><Input readOnly className="bg-muted" {...field} /></FormControl></FormItem>
          )}/>
        </div>
        <div className="grid grid-cols-3 gap-2">
            <FormField control={formInstance.control} name="cost" render={({ field }) => (<FormItem><FormLabel>S/ Costo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
            <FormField control={formInstance.control} name="shift" render={({ field }) => (
                <FormItem><FormLabel>Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-"/></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem></SelectContent></Select></FormItem>
            )}/>
            <FormField control={formInstance.control} name="pass" render={({ field }) => (<FormItem><FormLabel>Pasada</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-center space-x-2">
          <Label>Individual</Label>
          <Switch checked={formMode === 'group'} onCheckedChange={(c) => setFormMode(c ? 'group' : 'individual')} />
          <Label>Grupal</Label>
      </div>

      {formMode === 'individual' ? (
        <Form {...singleForm}>
           <form onSubmit={singleForm.handleSubmit(onSingleSubmit)}>
              <Card className="p-4 shadow-sm space-y-4">
                {renderSharedHeader(singleForm)}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField control={singleForm.control} name="performance" render={({ field }) => ( <FormItem><FormLabel>{performanceLabel}</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )}/>
                    {showExtraPerformanceField && (<FormField control={singleForm.control} name="clustersOrJabas" render={({ field }) => (<FormItem><FormLabel>{extraPerformanceLabel}</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/> )}
                    <FormField control={singleForm.control} name="personnelCount" render={({ field }) => (<FormItem><FormLabel># Pers.</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                    <FormField control={singleForm.control} name="workdayCount" render={({ field }) => (<FormItem><FormLabel># Jorn.</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                </div>
                <FormField control={singleForm.control} name="observations" render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem> )}/>
                <Button type="submit" className="w-full" disabled={isPending}>{isPending ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}Guardar</Button>
              </Card>
           </form>
         </Form>
      ) : (
        <Form {...headerForm}>
          <div className="space-y-4">
             <Card className="p-4 shadow-sm space-y-4">
                  {renderSharedHeader(headerForm)}
                  <div className="overflow-x-auto mt-4">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Asistente</TableHead>
                                  <TableHead className="w-24 text-center">{performanceLabel}</TableHead>
                                  {showExtraPerformanceField && <TableHead className="w-24 text-center">{extraPerformanceLabel}</TableHead>}
                                  <TableHead className="w-20 text-center">JHU</TableHead>
                                  <TableHead className="w-10"></TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {groupActivities.map((act, idx) => (
                                  <TableRow key={act.id}>
                                      <TableCell className="text-xs font-medium">{act.assistantName}</TableCell>
                                      <TableCell><Input type="number" value={act.performance || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, performance: Number(e.target.value)} : a))} className="h-8 text-center"/></TableCell>
                                      {showExtraPerformanceField && <TableCell><Input type="number" value={act.clustersOrJabas || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, clustersOrJabas: Number(e.target.value)} : a))} className="h-8 text-center"/></TableCell>}
                                      <TableCell><Input type="number" value={act.workdayCount || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, workdayCount: Number(e.target.value)} : a))} className="h-8 text-center"/></TableCell>
                                      <TableCell><Button variant="ghost" size="icon" onClick={() => setGroupActivities(prev => prev.filter(a => a.id !== act.id))}><Trash2 className="h-4 text-destructive"/></Button></TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                          <TableFooter><GroupFormTotals activities={groupActivities} showExtraPerformanceField={showExtraPerformanceField}/></TableFooter>
                      </Table>
                  </div>
                  <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsAddActivityDialogOpen(true)} className="flex-1"><PlusCircle className="mr-2 h-4"/>Asistente</Button>
                      <Button variant="outline" onClick={handleCaptureTable} disabled={groupActivities.length === 0}><Camera className="mr-2 h-4"/>Captura</Button>
                  </div>
                  <Button onClick={handleGroupSave} className="w-full" disabled={isPending || groupActivities.length === 0}>{isPending ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}Guardar Todos</Button>
             </Card>
          </div>
        </Form>
      )}

      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={reportRef} style={{ display: 'none' }}>
          <CaptureReport 
            activities={groupActivities} 
            header={headerForm.getValues()} 
            showExtraPerformanceField={showExtraPerformanceField}
            performanceLabel={performanceLabel}
            extraPerformanceLabel={extraPerformanceLabel}
            loteLabel={uniqueLotes.find(l => l.id === headerForm.getValues('lote'))?.lote || ''}
            responsableName={profile?.nombre || ''}
          />
        </div>
      </div>

      <AddAssistantActivityDialog
          isOpen={isAddActivityDialogOpen}
          setIsOpen={setIsAddActivityDialogOpen}
          onSelectAssistant={(a) => setGroupActivities(prev => [...prev, { ...a, id: crypto.randomUUID(), performance: 0, workdayCount: 0 }])}
          currentAssistantsDnis={groupActivities.map(f => f.assistantDni)}
      />
    </div>
  );
}
