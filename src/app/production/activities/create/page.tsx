
"use client";

import { useEffect, useMemo, useTransition, useState, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Loader2,
  PlusCircle,
  Trash2,
  Tag,
  Save,
  Wrench,
  Camera,
  Clock,
  Sprout,
  Grape,
  Boxes,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  workdayCount: z.coerce.number().optional(),
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

// --- Componentes Auxiliares fuera de la función principal para estabilidad ---

function GroupFormTotals({ activities, showExtraPerformanceField }: { activities: AssistantInGroup[], showExtraPerformanceField: boolean }) {
    const totals = useMemo(() => {
      const summary = { performance: 0, workdayCount: 0, clustersOrJabas: 0 };
      activities.forEach((curr) => {
        summary.performance += Number(curr.performance) || 0;
        summary.clustersOrJabas += Number(curr.clustersOrJabas) || 0;
        summary.workdayCount += Number(curr.workdayCount) || 0;
      });
      return summary;
    }, [activities]);

    return (
      <TableRow className="bg-muted/50 font-bold text-xs sm:text-sm">
        <TableCell className="text-right">Total</TableCell>
        <TableCell className="text-center">{totals.performance.toLocaleString('es-PE')}</TableCell>
        {showExtraPerformanceField && <TableCell className="text-center">{totals.clustersOrJabas.toLocaleString('es-PE')}</TableCell>}
        <TableCell className="text-center">{totals.workdayCount.toFixed(1)}</TableCell>
        <TableCell></TableCell>
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
  userName
}: { 
  activities: AssistantInGroup[], 
  header: any, 
  showExtraPerformanceField: boolean,
  performanceLabel: string,
  extraPerformanceLabel: string,
  loteLabel: string,
  userName: string
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
        <div className="text-right space-y-1">
          <p className="text-sm"><strong>RESPONSABLE:</strong> {userName.toUpperCase()}</p>
          <p className="text-xs text-gray-500 italic">Generado el {format(new Date(), 'Pp', { locale: es })}</p>
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
            <td className="border border-black p-2 bg-white"></td>
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
  const { labors, lotes, loading: masterLoading } = useMasterData();
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
      campaign: '2025',
      stage: 'produccion',
      lote: '',
      code: '',
      labor: '',
      performance: 0,
      clustersOrJabas: 0,
      personnelCount: 1,
      workdayCount: 0,
      cost: 0,
      shift: 'Mañana',
      pass: 1,
      observations: '',
      createdBy: '',
    },
  });

  const headerForm = useForm<HeaderFormValues>({
    resolver: zodResolver(headerSchema),
    defaultValues: {
      registerDate: new Date(),
      campaign: '2025',
      stage: 'produccion',
      lote: '',
      code: '',
      labor: '',
      shift: 'Mañana',
      pass: 1,
      cost: 0,
    }
  });

  // Watchers para auto-completado de labor
  const singleCode = useWatch({ control: singleForm.control, name: 'code' });
  const headerCode = useWatch({ control: headerForm.control, name: 'code' });

  useEffect(() => {
    if (formMode === 'individual' && singleCode) {
      const matched = labors.find(l => String(l.codigo) === String(singleCode));
      singleForm.setValue('labor', matched?.descripcion || '', { shouldValidate: true });
    }
  }, [singleCode, labors, formMode, singleForm]);

  useEffect(() => {
    if (formMode === 'group' && headerCode) {
      const matched = labors.find(l => String(l.codigo) === String(headerCode));
      headerForm.setValue('labor', matched?.descripcion || '', { shouldValidate: true });
    }
  }, [headerCode, labors, formMode, headerForm]);

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
      if (!map.has(lote.lote)) map.set(lote.lote, lote);
    });
    return Array.from(map.values());
  }, [lotes]);

  const currentCode = formMode === 'individual' ? singleCode : headerCode;
  const showExtraPerformanceField = useMemo(() => ['46', '67'].includes(String(currentCode) || ''), [currentCode]);
  const performanceLabel = showExtraPerformanceField ? "Rdto (Plta)" : "Rendimiento";
  const extraPerformanceLabel = String(currentCode) === '46' ? "Racimos" : "Jabas";

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
      toast({ title: "Captura Guardada" });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al capturar' });
    }
  };

  const onSingleSubmit = (data: SingleActivityFormValues) => {
    if (!profile?.email) return;
    startTransition(async () => {
        const loteData = lotes.find(l => l.id === data.lote);
        if (!loteData) return;
        try {
            await addDoc(collection(db, 'actividades'), {
                ...data,
                lote: loteData.lote,
                variedad: loteData.variedad,
                registerDate: Timestamp.fromDate(data.registerDate),
                createdBy: profile.email,
                createdAt: serverTimestamp(),
            });
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
      toast({ variant: 'destructive', title: 'Error', description: 'Complete los datos obligatorios.' });
      return;
    }
    const headerValues = headerForm.getValues();
    const loteData = lotes.find(l => l.id === headerValues.lote);
    if (!loteData) return;

    startTransition(async () => {
        let count = 0;
        for (const act of groupActivities) {
            try {
                await addDoc(collection(db, 'actividades'), {
                    ...headerValues,
                    lote: loteData.lote,
                    variedad: loteData.variedad,
                    registerDate: Timestamp.fromDate(headerValues.registerDate),
                    assistantDni: act.assistantDni,
                    assistantName: act.assistantName,
                    performance: Number(act.performance) || 0,
                    clustersOrJabas: Number(act.clustersOrJabas) || 0,
                    personnelCount: 1,
                    workdayCount: Number(act.workdayCount) || 0,
                    observations: act.observations || '',
                    createdBy: profile.email,
                    createdAt: serverTimestamp(),
                });
                count++;
            } catch (e) {}
        }
        toast({ title: 'Éxito', description: `${count} registros guardados.` });
        setGroupActivities([]);
    });
  };

  const handleAddAssistant = (a: { assistantDni: string, assistantName: string }) => {
    setGroupActivities(prev => [...prev, { ...a, id: crypto.randomUUID(), performance: 0, workdayCount: 0 }]);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-center space-x-2 p-2 bg-muted rounded-lg w-fit mx-auto">
          <Label className={cn(formMode === 'individual' && "font-bold text-primary")}>Individual</Label>
          <Switch checked={formMode === 'group'} onCheckedChange={(c) => setFormMode(c ? 'group' : 'individual')} />
          <Label className={cn(formMode === 'group' && "font-bold text-primary")}>Grupal</Label>
      </div>

      {formMode === 'individual' ? (
        <Form {...singleForm}>
           <form onSubmit={singleForm.handleSubmit(onSingleSubmit)}>
              <Card className="p-4 shadow-sm space-y-4">
                <div className="space-y-4">
                  <FormField control={singleForm.control} name="registerDate" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>Fecha</FormLabel>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                          <PopoverTrigger asChild><FormControl><Button variant={"outline"} className="w-full text-left font-normal">{field.value ? format(field.value, "d 'de' MMMM, yyyy", { locale: es }) : "Elegir fecha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(d) => { field.onChange(d); setIsCalendarOpen(false); }} initialFocus locale={es}/></PopoverContent>
                        </Popover>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-2">
                      <FormField control={singleForm.control} name="campaign" render={({ field }) => (
                        <FormItem><FormLabel>Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select></FormItem>
                      )}/>
                      <FormField control={singleForm.control} name="stage" render={({ field }) => (
                        <FormItem><FormLabel>Etapa</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select></FormItem>
                      )}/>
                      <FormField control={singleForm.control} name="lote" render={({ field }) => (
                        <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.id}>{l.lote}</SelectItem>)}</SelectContent></Select></FormItem>
                      )}/>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField control={singleForm.control} name="code" render={({ field }) => (
                      <FormItem><FormLabel>Cód.</FormLabel><FormControl><Input placeholder="31" {...field} /></FormControl></FormItem>
                    )}/>
                    <FormField control={singleForm.control} name="labor" render={({ field }) => (
                      <FormItem className="col-span-2"><FormLabel>Labor</FormLabel><FormControl><Input readOnly className="bg-muted" {...field} /></FormControl></FormItem>
                    )}/>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                      <FormField control={singleForm.control} name="cost" render={({ field }) => (<FormItem><FormLabel>S/ Costo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                      <FormField control={singleForm.control} name="shift" render={({ field }) => (
                          <FormItem><FormLabel>Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-"/></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem></SelectContent></Select></FormItem>
                      )}/>
                      <FormField control={singleForm.control} name="pass" render={({ field }) => (<FormItem><FormLabel>Pasada</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    <FormField control={singleForm.control} name="performance" render={({ field }) => ( <FormItem><FormLabel>{performanceLabel}</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )}/>
                    {showExtraPerformanceField && (<FormField control={singleForm.control} name="clustersOrJabas" render={({ field }) => (<FormItem><FormLabel>{extraPerformanceLabel}</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/> )}
                    <FormField control={singleForm.control} name="workdayCount" render={({ field }) => (<FormItem><FormLabel>JHU</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl></FormItem>)}/>
                </div>
                <FormField control={singleForm.control} name="observations" render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem> )}/>
                <Button type="submit" className="w-full" disabled={isPending}>{isPending ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}Guardar Registro</Button>
              </Card>
           </form>
         </Form>
      ) : (
        <Form {...headerForm}>
          <div className="space-y-4">
             <Card className="p-4 shadow-sm space-y-4">
                  <div className="space-y-4">
                    <FormField control={headerForm.control} name="registerDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Fecha</FormLabel>
                          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild><FormControl><Button variant={"outline"} className="w-full text-left font-normal">{field.value ? format(field.value, "d 'de' MMMM, yyyy", { locale: es }) : "Elegir fecha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(d) => { field.onChange(d); setIsCalendarOpen(false); }} initialFocus locale={es}/></PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-2">
                        <FormField control={headerForm.control} name="campaign" render={({ field }) => (
                          <FormItem><FormLabel>Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select></FormItem>
                        )}/>
                        <FormField control={headerForm.control} name="stage" render={({ field }) => (
                          <FormItem><FormLabel>Etapa</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select></FormItem>
                        )}/>
                        <FormField control={headerForm.control} name="lote" render={({ field }) => (
                          <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.id}>{l.lote}</SelectItem>)}</SelectContent></Select></FormItem>
                        )}/>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <FormField control={headerForm.control} name="code" render={({ field }) => (
                        <FormItem><FormLabel>Cód.</FormLabel><FormControl><Input placeholder="31" {...field} /></FormControl></FormItem>
                      )}/>
                      <FormField control={headerForm.control} name="labor" render={({ field }) => (
                        <FormItem className="col-span-2"><FormLabel>Labor</FormLabel><FormControl><Input readOnly className="bg-muted" {...field} /></FormControl></FormItem>
                      )}/>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <FormField control={headerForm.control} name="cost" render={({ field }) => (<FormItem><FormLabel>S/ Costo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                        <FormField control={headerForm.control} name="shift" render={({ field }) => (
                            <FormItem><FormLabel>Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-"/></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem></SelectContent></Select></FormItem>
                        )}/>
                        <FormField control={headerForm.control} name="pass" render={({ field }) => (<FormItem><FormLabel>Pasada</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                    </div>
                  </div>
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
                                      <TableCell><Input type="number" value={act.performance || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, performance: Number(e.target.value)} : a))} className="h-8 text-center text-xs"/></TableCell>
                                      {showExtraPerformanceField && <TableCell><Input type="number" value={act.clustersOrJabas || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, clustersOrJabas: Number(e.target.value)} : a))} className="h-8 text-center text-xs"/></TableCell>}
                                      <TableCell><Input type="number" step="0.1" value={act.workdayCount || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, workdayCount: Number(e.target.value)} : a))} className="h-8 text-center text-xs"/></TableCell>
                                      <TableCell><Button variant="ghost" size="icon" onClick={() => setGroupActivities(prev => prev.filter(a => a.id !== act.id))}><Trash2 className="h-4 text-destructive"/></Button></TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                          <TableFooter><GroupFormTotals activities={groupActivities} showExtraPerformanceField={showExtraPerformanceField}/></TableFooter>
                      </Table>
                  </div>
                  <div className="flex gap-2">
                      <Button variant="outline" type="button" onClick={() => setIsAddActivityDialogOpen(true)} className="flex-1"><PlusCircle className="mr-2 h-4"/>Asistente</Button>
                      <Button variant="outline" type="button" onClick={handleCaptureTable} disabled={groupActivities.length === 0}><Camera className="mr-2 h-4"/>Captura</Button>
                  </div>
                  <Button type="button" onClick={handleGroupSave} className="w-full" disabled={isPending || groupActivities.length === 0}>{isPending ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}Guardar Grupo</Button>
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
            userName={profile?.nombre || 'N/A'}
          />
        </div>
      </div>

      <AddAssistantActivityDialog
          isOpen={isAddActivityDialogOpen}
          setIsOpen={setIsAddActivityDialogOpen}
          onSelectAssistant={handleAddAssistant}
          currentAssistantsDnis={groupActivities.map(f => f.assistantDni)}
      />
    </div>
  );
}
