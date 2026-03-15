
"use client";

import { useEffect, useMemo, useTransition, useState, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Loader2,
  Save,
  Sprout,
  Clock,
  Briefcase,
  Flame,
  Tag,
  Wrench,
  TrendingUp,
  Users,
  ClipboardList,
  Calculator,
  RefreshCcw,
  ArrowLeftToLine,
  ArrowRightToLine,
  Pencil,
  Camera,
  PlusCircle,
  Trash2,
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
import { ActivityRecordSchema } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useMasterData } from '@/context/MasterDataContext';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AddAssistantActivityDialog from '@/components/AddAssistantActivityDialog';

// --- Esquemas ---
type SingleActivityFormValues = z.infer<typeof ActivityRecordSchema>;

const assistantInGroupSchema = z.object({
  id: z.string(),
  assistantDni: z.string(),
  assistantName: z.string(),
  performance: z.coerce.number().optional(),
  personnelCount: z.coerce.number().int().min(1).optional(),
  workdayCount: z.coerce.number().optional(),
  minRange: z.coerce.number().optional(),
  maxRange: z.coerce.number().optional(),
  observations: z.string().optional(),
  clustersOrJabas: z.coerce.number().optional(),
});
type AssistantInGroup = z.infer<typeof assistantInGroupSchema>;

const headerSchema = z.object({
    registerDate: z.date({required_error: "La fecha es requerida."}),
    campaign: z.string().min(1, "La campaña es requerida."),
    stage: z.string().min(1, "La etapa es requerida."),
    lote: z.string().min(1, "El lote es requerido."),
    code: z.string().optional(),
    labor: z.string().optional(),
    shift: z.string().min(1, "El turno es requerido."),
    pass: z.coerce.number().int().optional(),
    cost: z.coerce.number().optional(),
});
type HeaderFormValues = z.infer<typeof headerSchema>;

// --- Componente de Reporte para Captura (Diseño Imagen 1) ---
function CaptureReport({ 
  activities, 
  header, 
  loteLabel,
  userName
}: { 
  activities: AssistantInGroup[], 
  header: any, 
  loteLabel: string,
  userName: string
}) {
  const minValues = activities.map(a => Number(a.minRange) || 0).filter(v => v > 0);
  const maxValues = activities.map(a => Number(a.maxRange) || 0).filter(v => v > 0);

  const totals = {
    performance: activities.reduce((sum, a) => sum + (Number(a.performance) || 0), 0),
    personnel: activities.reduce((sum, a) => sum + (Number(a.personnelCount) || 0), 0),
    jhu: activities.reduce((sum, a) => sum + (Number(a.workdayCount) || 0), 0),
    min: minValues.length > 0 ? Math.min(...minValues) : 0,
    max: maxValues.length > 0 ? Math.max(...maxValues) : 0,
  };

  const globalAverage = totals.jhu > 0 ? totals.performance / totals.jhu : 0;

  return (
    <div className="bg-white p-8 text-black font-sans border-2 border-black" style={{ width: '1200px' }}>
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold border-b-2 border-black pb-1 uppercase underline">REPORTE DE CAMPO - FICHA DE ACTIVIDAD</h2>
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
            <th className="border border-black p-2 text-center w-24">RDTO</th>
            <th className="border border-black p-2 text-center w-24">PERSONAS</th>
            <th className="border border-black p-2 text-center w-24">JHU</th>
            <th className="border border-black p-2 text-center w-24">PROM.</th>
            <th className="border border-black p-2 text-center w-24">MÍNIMO</th>
            <th className="border border-black p-2 text-center w-24">MÁXIMO</th>
            <th className="border border-black p-2 text-left">OBS.</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act) => {
            const prom = (Number(act.performance) || 0) / (Number(act.workdayCount) || 1);
            return (
              <tr key={act.id}>
                <td className="border border-black p-2 font-medium">{act.assistantName}</td>
                <td className="border border-black p-2 text-center">{Number(act.performance || 0).toLocaleString('es-PE')}</td>
                <td className="border border-black p-2 text-center">{Number(act.personnelCount || 0)}</td>
                <td className="border border-black p-2 text-center">{Number(act.workdayCount || 0).toFixed(1)}</td>
                <td className="border border-black p-2 text-center">{prom.toFixed(2)}</td>
                <td className="border border-black p-2 text-center">{Number(act.minRange || 0)}</td>
                <td className="border border-black p-2 text-center">{Number(act.maxRange || 0)}</td>
                <td className="border border-black p-2 text-xs italic">{act.observations || '---'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-white font-bold">
          <tr className="border-t-2 border-black">
            <td className="border border-black p-2 text-right">TOTAL GENERAL</td>
            <td className="border border-black p-2 text-center">{totals.performance.toLocaleString('es-PE')}</td>
            <td className="border border-black p-2 text-center">{totals.personnel}</td>
            <td className="border border-black p-2 text-center text-[#7c3aed] font-bold">{totals.jhu.toFixed(1)}</td>
            <td className="border border-black p-2 text-center">{globalAverage.toFixed(2)}</td>
            <td className="border border-black p-2 text-center">{totals.min}</td>
            <td className="border border-black p-2 text-center">{totals.max}</td>
            <td className="border border-black p-2 bg-white"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// --- Formulario Individual ---
function IndividualForm({ profile, labors, uniqueLotes, lotes }: any) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const form = useForm<SingleActivityFormValues>({
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
      createdBy: profile?.email || '',
      assistantDni: profile?.dni || '',
      assistantName: profile?.nombre || '',
    },
  });

  const code = useWatch({ control: form.control, name: 'code' });
  useEffect(() => {
    if (code) {
      const matched = labors.find((l: any) => String(l.codigo) === String(code));
      form.setValue('labor', matched?.descripcion || '', { shouldValidate: true });
    }
  }, [code, labors, form]);

  const onSubmit = (data: SingleActivityFormValues) => {
    if (!profile?.email) return;
    startTransition(async () => {
        const loteData = lotes.find((l: any) => l.lote === data.lote);
        try {
            await addDoc(collection(db, 'actividades'), {
                ...data,
                variedad: loteData?.variedad || 'N/A',
                registerDate: Timestamp.fromDate(data.registerDate),
                createdBy: profile.email,
                createdAt: serverTimestamp(),
            });
            toast({ title: 'Éxito', description: 'Registro guardado.' });
            form.reset({ ...form.getValues(), code: '', labor: '', performance: 0, workdayCount: 0, observations: '' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="shadow-sm border">
          <CardContent className="p-6 space-y-6">
            <FormField control={form.control} name="registerDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2 font-semibold"><CalendarIcon className="h-4 w-4 text-muted-foreground"/> Fecha de Registro</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                          <Button variant={"outline"} className="w-full text-left font-normal bg-slate-50 h-12 border-slate-200">
                              {field.value ? format(field.value, "d 'de' MMMM 'de' yyyy", { locale: es }) : "Elegir fecha"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={(d) => { field.onChange(d); setIsCalendarOpen(false); }} initialFocus locale={es}/>
                    </PopoverContent>
                  </Popover>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="campaign" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Briefcase className="h-4 w-4 text-muted-foreground"/> Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select></FormItem>
                )}/>
                <FormField control={form.control} name="stage" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Flame className="h-4 w-4 text-muted-foreground"/> Etapa</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Selecc." /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="formacion">Formacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select></FormItem>
                )}/>
                <FormField control={form.control} name="lote" render={({ field }) => (
                  <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Sprout className="h-4 w-4 text-muted-foreground"/> Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Selecc."/></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map((l: any) => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent></Select></FormItem>
                )}/>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem className="col-span-1"><FormLabel className="flex items-center gap-2 font-semibold"><Tag className="h-4 w-4 text-muted-foreground"/> Cód.</FormLabel><FormControl><Input placeholder="Ej: 1001" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem>
              )}/>
              <FormField control={form.control} name="labor" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel className="flex items-center gap-2 font-semibold"><Wrench className="h-4 w-4 text-muted-foreground"/> Labor</FormLabel><FormControl><Input placeholder="Labor (auto-complet)" readOnly className="bg-slate-50 border-slate-200 text-muted-foreground" {...field} /></FormControl></FormItem>
              )}/>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="performance" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-muted-foreground"/> Rdto</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem> )}/>
              <FormField control={form.control} name="personnelCount" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-muted-foreground"/> # Personas</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem> )}/>
              <FormField control={form.control} name="workdayCount" render={({ field }) => ( <FormItem className="relative"><FormLabel className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4 text-muted-foreground"/> # Jornadas (JHU)</FormLabel><FormControl><Input type="number" step="0.1" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem> )}/>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="cost" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4 text-muted-foreground"/> S/ Costo (PEN)</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem>)}/>
                <FormField control={form.control} name="shift" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-muted-foreground"/> Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Selecc."/></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem></SelectContent></Select></FormItem>
                )}/>
                <FormField control={form.control} name="pass" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2 font-semibold"><RefreshCcw className="h-4 w-4 text-muted-foreground"/> Pasada</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem>)}/>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="minRange" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><ArrowLeftToLine className="h-4 w-4 text-muted-foreground"/> Min</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem> )}/>
              <FormField control={form.control} name="maxRange" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><ArrowRightToLine className="h-4 w-4 text-muted-foreground"/> Max</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem> )}/>
            </div>

            <FormField control={form.control} name="observations" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Pencil className="h-4 w-4 text-muted-foreground"/> Observaciones</FormLabel><FormControl><Textarea placeholder="Escribe aquí tus observaciones..." {...field} className="bg-slate-50 border-slate-200 min-h-[100px]" /></FormControl></FormItem> )}/>
          </CardContent>
        </Card>
        
        <div className="fixed bottom-6 right-6 z-50">
            <Button type="submit" size="lg" className="h-14 px-8 text-lg font-bold bg-[#7c3aed] hover:bg-[#6d28d9] rounded-2xl shadow-xl transition-all" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
              Guardar Ficha
            </Button>
        </div>
      </form>
    </Form>
  );
}

// --- Formulario Grupal ---
function GroupForm({ profile, labors, uniqueLotes, lotes, reportRef, handleCapture }: any) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [groupActivities, setGroupActivities] = useState<AssistantInGroup[]>([]);
  const [isAddAssistantDialogOpen, setIsAddAssistantDialogOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const form = useForm<HeaderFormValues>({
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

  const code = useWatch({ control: form.control, name: 'code' });
  useEffect(() => {
    if (code) {
      const matched = labors.find((l: any) => String(l.codigo) === String(code));
      form.setValue('labor', matched?.descripcion || '', { shouldValidate: true });
    }
  }, [code, labors, form]);

  const handleGroupSave = async () => {
    if (groupActivities.length === 0 || !profile?.email) return;
    const headerValues = form.getValues();
    const loteData = lotes.find((l: any) => l.lote === headerValues.lote);

    startTransition(async () => {
        let count = 0;
        for (const act of groupActivities) {
            try {
                await addDoc(collection(db, 'actividades'), {
                    ...headerValues,
                    variedad: loteData?.variedad || 'N/A',
                    registerDate: Timestamp.fromDate(headerValues.registerDate),
                    assistantDni: act.assistantDni,
                    assistantName: act.assistantName,
                    performance: Number(act.performance) || 0,
                    personnelCount: Number(act.personnelCount) || 1,
                    workdayCount: Number(act.workdayCount) || 0,
                    minRange: Number(act.minRange) || 0,
                    maxRange: Number(act.maxRange) || 0,
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

  const totals = useMemo(() => {
    const allMinValues = groupActivities.map(a => Number(a.minRange) || 0).filter(v => v > 0);
    const allMaxValues = groupActivities.map(a => Number(a.maxRange) || 0).filter(v => v > 0);

    const validActivities = groupActivities.filter(a => (Number(a.performance) || 0) > 0 || (Number(a.workdayCount) || 0) > 0);
    
    const performance = validActivities.reduce((sum, a) => sum + (Number(a.performance) || 0), 0);
    const personnel = validActivities.reduce((sum, a) => sum + (Number(a.personnelCount) || 0), 0);
    const jhu = validActivities.reduce((sum, a) => sum + (Number(a.workdayCount) || 0), 0);
    
    // CORRECCIÓN: El total debe mostrar el mínimo absoluto y el máximo absoluto
    const min = allMinValues.length > 0 ? Math.min(...allMinValues) : 0;
    const max = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;

    return { rdto: performance, personas: personnel, jhu, min, max };
  }, [groupActivities]);

  const globalAverage = totals.jhu > 0 ? totals.rdto / totals.jhu : 0;

  return (
    <Form {...form}>
      <div className="space-y-6">
         <Card className="shadow-sm border">
            <CardContent className="p-6 space-y-6">
                <FormField control={form.control} name="registerDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center gap-2 font-semibold"><CalendarIcon className="h-4 w-4 text-muted-foreground"/> Fecha de Registro</FormLabel>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <FormControl><Button variant={"outline"} className="w-full text-left font-normal bg-slate-50 h-12 border-slate-200">{field.value ? format(field.value, "d 'de' MMMM 'de' yyyy", { locale: es }) : "Elegir fecha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(d) => { field.onChange(d); setIsCalendarOpen(false); }} initialFocus locale={es}/></PopoverContent>
                      </Popover>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="campaign" render={({ field }) => (
                      <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Briefcase className="h-4 w-4 text-muted-foreground"/> Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select></FormItem>
                    )}/>
                    <FormField control={form.control} name="stage" render={({ field }) => (
                      <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Flame className="h-4 w-4 text-muted-foreground"/> Etapa</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="formacion">Formacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select></FormItem>
                    )}/>
                    <FormField control={form.control} name="lote" render={({ field }) => (
                      <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Sprout className="h-4 w-4 text-muted-foreground"/> Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Selecc."/></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map((l: any) => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent></Select></FormItem>
                    )}/>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem className="col-span-1"><FormLabel className="flex items-center gap-2 font-semibold"><Tag className="h-4 w-4 text-muted-foreground"/> Cód.</FormLabel><FormControl><Input placeholder="Ej: 1001" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem>
                  )}/>
                  <FormField control={form.control} name="labor" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel className="flex items-center gap-2 font-semibold"><Wrench className="h-4 w-4 text-muted-foreground"/> Labor</FormLabel><FormControl><Input readOnly className="bg-slate-50 border-slate-200 text-muted-foreground" {...field} /></FormControl></FormItem>
                  )}/>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="cost" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4 text-muted-foreground"/> S/ Costo</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem>)}/>
                    <FormField control={form.control} name="shift" render={({ field }) => (
                        <FormItem><FormLabel className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-muted-foreground"/> Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue placeholder="Selecc."/></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem></SelectContent></Select></FormItem>
                    )}/>
                    <FormField control={form.control} name="pass" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-2 font-semibold"><RefreshCcw className="h-4 w-4 text-muted-foreground"/> Pasada</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-50 border-slate-200"/></FormControl></FormItem>)}/>
                </div>
            </CardContent>
         </Card>

         <Card className="shadow-sm border overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                  <Table className="text-sm">
                      <TableHeader className="bg-muted/30">
                          <TableRow>
                              <TableHead className="font-bold whitespace-nowrap min-w-[180px]">Asistente</TableHead>
                              <TableHead className="w-64 text-center font-bold">Rdto</TableHead>
                              <TableHead className="w-48 text-center font-bold">Personas</TableHead>
                              <TableHead className="w-64 text-center font-bold">JHU</TableHead>
                              <TableHead className="w-32 text-center font-bold">Prom.</TableHead>
                              <TableHead className="w-64 text-center font-bold">Mínimo</TableHead>
                              <TableHead className="w-64 text-center font-bold">Máximo</TableHead>
                              <TableHead className="w-60 text-center font-bold">Obs.</TableHead>
                              <TableHead className="w-10"></TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {groupActivities.map((act, idx) => {
                              const prom = (Number(act.performance) || 0) / (Number(act.workdayCount) || 1);
                              return (
                                <TableRow key={act.id}>
                                    <TableCell className="font-medium py-3 px-2 whitespace-nowrap uppercase">{act.assistantName}</TableCell>
                                    <TableCell className="p-1"><Input type="number" value={act.performance || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, performance: Number(e.target.value)} : a))} className="h-14 text-center text-2xl font-bold bg-slate-50 border-slate-200 min-w-[220px] w-full"/></TableCell>
                                    <TableCell className="p-1"><Input type="number" value={act.personnelCount || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, personnelCount: Number(e.target.value)} : a))} className="h-14 text-center text-2xl font-bold bg-slate-50 border-slate-200 min-w-[160px] w-full"/></TableCell>
                                    <TableCell className="p-1"><Input type="number" step="0.1" value={act.workdayCount || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, workdayCount: Number(e.target.value)} : a))} className="h-14 text-center text-2xl font-bold bg-slate-50 border-slate-200 min-w-[220px] w-full"/></TableCell>
                                    <TableCell className="p-1 text-center font-mono text-muted-foreground text-xl min-w-[100px]">{prom.toFixed(2)}</TableCell>
                                    <TableCell className="p-1"><Input type="number" value={act.minRange || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, minRange: Number(e.target.value)} : a))} className="h-14 text-center text-2xl font-bold bg-slate-50 border-slate-200 min-w-[220px] w-full"/></TableCell>
                                    <TableCell className="p-1"><Input type="number" value={act.maxRange || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, maxRange: Number(e.target.value)} : a))} className="h-14 text-center text-2xl font-bold bg-slate-50 border-slate-200 min-w-[220px] w-full"/></TableCell>
                                    <TableCell className="p-1"><Input type="text" value={act.observations || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, observations: e.target.value} : a))} className="h-14 text-lg bg-slate-50 border-slate-200 w-full min-w-[220px]"/></TableCell>
                                    <TableCell className="p-1"><Button variant="ghost" size="icon" onClick={() => setGroupActivities(prev => prev.filter(a => a.id !== act.id))} className="h-10 w-10"><Trash2 className="h-5 text-destructive"/></Button></TableCell>
                                </TableRow>
                              )
                          })}
                          {groupActivities.length === 0 && (
                            <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground italic">No hay asistentes agregados.</TableCell></TableRow>
                          )}
                      </TableBody>
                      {groupActivities.length > 0 && (
                        <TableFooter className="bg-white font-bold">
                            <TableRow className="border-t-2 border-slate-200">
                                <td className="text-right text-lg py-4 px-2 uppercase">TOTAL GENERAL</td>
                                <td className="text-center text-lg">{totals.rdto.toLocaleString('es-PE')}</td>
                                <td className="text-center text-lg">{totals.personas}</td>
                                <td className="text-center text-lg text-[#7c3aed] font-bold">{totals.jhu.toFixed(1)}</td>
                                <td className="text-center text-lg">{globalAverage.toFixed(2)}</td>
                                <td className="text-center text-lg">{totals.min.toLocaleString('es-PE')}</td>
                                <td className="text-center text-lg">{totals.max.toLocaleString('es-PE')}</td>
                                <td colSpan={2}></td>
                            </TableRow>
                        </TableFooter>
                      )}
                  </Table>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 p-4 gap-3 border-t">
                <Button variant="outline" type="button" onClick={() => setIsAddAssistantDialogOpen(true)} className="flex-1 h-12 text-base"><PlusCircle className="mr-2 h-5 w-5"/>Agregar Fila</Button>
                <Button variant="outline" type="button" onClick={() => handleCapture(groupActivities, form.getValues(), form.getValues('lote'))} disabled={groupActivities.length === 0} className="h-12 text-base border-primary/50 text-primary hover:bg-primary/5"><Camera className="mr-2 h-5 w-5"/>Capturar Tabla</Button>
            </CardFooter>
         </Card>

         <div className="fixed bottom-6 right-6 z-50">
            <Button type="button" onClick={handleGroupSave} size="lg" className="h-14 px-8 text-lg font-bold bg-[#7c3aed] hover:bg-[#6d28d9] rounded-2xl shadow-xl transition-all" disabled={isPending || groupActivities.length === 0}>
                {isPending ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 h-5 w-5"/>}
                Guardar {groupActivities.length} Registros
            </Button>
         </div>

         <AddAssistantActivityDialog
            isOpen={isAddAssistantDialogOpen}
            setIsOpen={setIsAddAssistantDialogOpen}
            onSelectAssistant={(a) => setGroupActivities(prev => [...prev, { ...a, id: crypto.randomUUID(), performance: 0, workdayCount: 0, personnelCount: 1, minRange: 0, maxRange: 0, observations: '' }])}
            currentAssistantsDnis={groupActivities.map(f => f.assistantDni)}
        />

        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div ref={reportRef}>
            <CaptureReport 
              activities={groupActivities} 
              header={form.getValues()} 
              loteLabel={form.getValues('lote')}
              userName={profile?.nombre || 'N/A'}
            />
          </div>
        </div>
      </div>
    </Form>
  );
}

// --- Componente Principal ---
export default function CreateActivityPage() {
  const { setActions } = useHeaderActions();
  const { profile } = useAuth();
  const { labors, lotes, loading: masterLoading } = useMasterData();
  const { toast } = useToast();
  const [formMode, setFormMode] = useState<'individual' | 'group'>('individual');
  const [mounted, setMounted] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setActions({ title: "Ficha de Actividad" });
    return () => setActions({});
  }, [setActions]);

  const uniqueLotes = useMemo(() => {
    const map = new Map<string, any>();
    lotes.forEach(lote => {
      if (!map.has(lote.lote)) map.set(lote.lote, lote);
    });
    return Array.from(map.values()).sort((a,b) => a.lote.localeCompare(b.lote, undefined, {numeric: true}));
  }, [lotes]);

  const handleCapture = async (activities: any[], header: any, loteL: string) => {
    if (!reportRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const originalDisplay = reportRef.current.style.display;
      reportRef.current.style.display = 'block';
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });
      reportRef.current.style.display = originalDisplay;
      const link = document.createElement('a');
      link.download = `Reporte_Campo_${format(new Date(), 'ddMMyy_HHmm')}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Captura Guardada", description: "El reporte se ha descargado como imagen." });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error al capturar' });
    }
  };

  if (!mounted || !profile) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className={cn("mx-auto space-y-6 pb-24", formMode === 'group' ? "max-w-5xl" : "max-w-xl")}>
      <div className="flex items-center justify-center space-x-4 p-2 bg-slate-100/50 rounded-xl w-fit mx-auto">
          <Label className={cn("text-sm transition-all cursor-pointer", formMode === 'individual' ? "font-bold text-foreground" : "text-muted-foreground")}>Individual</Label>
          <Switch checked={formMode === 'group'} onCheckedChange={(c) => setFormMode(c ? 'group' : 'individual')} />
          <Label className={cn("text-sm transition-all cursor-pointer", formMode === 'group' ? "font-bold text-foreground" : "text-muted-foreground")}>Grupos</Label>
      </div>

      {formMode === 'individual' ? (
        <IndividualForm profile={profile} labors={labors} uniqueLotes={uniqueLotes} lotes={lotes} />
      ) : (
        <GroupForm profile={profile} labors={labors} uniqueLotes={uniqueLotes} lotes={lotes} reportRef={reportRef} handleCapture={handleCapture} />
      )}
    </div>
  );
}
