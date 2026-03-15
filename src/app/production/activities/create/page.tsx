
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
  PlusCircle,
  Trash2,
  Save,
  Camera,
  Grape,
  Boxes,
  Sprout,
  Clock,
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AddAssistantActivityDialog from '@/components/AddAssistantActivityDialog';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';

// --- Tipos y Esquemas ---
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

// --- Componente de Reporte para Captura ---
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

// --- Formulario Individual ---
function IndividualActivityForm({ 
  profile, 
  labors, 
  uniqueLotes, 
  lotes,
  performanceLabel,
  extraPerformanceLabel,
  showExtraPerformanceField
}: any) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
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
        const loteData = lotes.find((l: any) => l.id === data.lote);
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
            form.reset({ ...form.getValues(), code: '', labor: '', performance: 0, workdayCount: 0, observations: '' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="shadow-lg border-primary/10 overflow-hidden">
          <CardHeader className="bg-primary/5 border-b pb-4">
              <CardTitle className="text-lg flex items-center gap-2"><Sprout className="h-5 w-5 text-primary"/> Datos del Lote y Labor</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <FormField control={form.control} name="registerDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Trabajo</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                          <Button variant={"outline"} className="w-full text-left font-normal border-muted-foreground/20">
                              {field.value ? format(field.value, "d 'de' MMMM, yyyy", { locale: es }) : "Elegir fecha"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es}/>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField control={form.control} name="campaign" render={({ field }) => (
                  <FormItem><FormLabel>Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select></FormItem>
                )}/>
                <FormField control={form.control} name="stage" render={({ field }) => (
                  <FormItem><FormLabel>Etapa</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select></FormItem>
                )}/>
                <FormField control={form.control} name="lote" render={({ field }) => (
                  <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-"/></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.lote}</SelectItem>)}</SelectContent></Select></FormItem>
                )}/>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem className="col-span-1"><FormLabel>Cód.</FormLabel><FormControl><Input placeholder="31" {...field} className="text-center font-bold"/></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="labor" render={({ field }) => (
                <FormItem className="col-span-3"><FormLabel>Labor</FormLabel><FormControl><Input readOnly className="bg-muted font-medium" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="cost" render={({ field }) => (<FormItem><FormLabel>S/ Costo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                <FormField control={form.control} name="shift" render={({ field }) => (
                    <FormItem><FormLabel>Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-"/></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem></SelectContent></Select></FormItem>
                )}/>
                <FormField control={form.control} name="pass" render={({ field }) => (<FormItem><FormLabel>Pasada</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
              <FormField control={form.control} name="performance" render={({ field }) => ( <FormItem><FormLabel className="text-primary font-bold">{performanceLabel}</FormLabel><FormControl><Input type="number" {...field} className="border-primary/30"/></FormControl></FormItem> )}/>
              {showExtraPerformanceField && (<FormField control={form.control} name="clustersOrJabas" render={({ field }) => (<FormItem><FormLabel className="text-primary font-bold">{extraPerformanceLabel}</FormLabel><FormControl><Input type="number" {...field} className="border-primary/30"/></FormControl></FormItem>)}/> )}
              <FormField control={form.control} name="workdayCount" render={({ field }) => (<FormItem><FormLabel className="font-bold">Jornadas (JHU)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl></FormItem>)}/>
            </div>

            <FormField control={form.control} name="observations" render={({ field }) => ( <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea placeholder="Notas adicionales..." {...field} /></FormControl></FormItem> )}/>
            
            <Button type="submit" className="w-full h-12 text-lg shadow-md" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
              Guardar Ficha
            </Button>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

// --- Formulario Grupal ---
function GroupActivityForm({ 
  profile, 
  labors, 
  uniqueLotes, 
  lotes,
  performanceLabel,
  extraPerformanceLabel,
  showExtraPerformanceField,
  reportRef,
  handleCaptureTable
}: any) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [groupActivities, setGroupActivities] = useState<AssistantInGroup[]>([]);
  const [isAddAssistantDialogOpen, setIsAddAssistantDialogOpen] = useState(false);

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
    const isValidHeader = await form.trigger();
    if (!isValidHeader || groupActivities.length === 0 || !profile?.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'Complete los datos obligatorios.' });
      return;
    }
    const headerValues = form.getValues();
    const loteData = lotes.find((l: any) => l.id === headerValues.lote);
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

  return (
    <Form {...form}>
      <div className="space-y-6">
         <Card className="shadow-lg border-primary/10">
            <CardHeader className="bg-primary/5 border-b pb-4">
                <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-primary"/> Cabecera de Grupo</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <FormField control={form.control} name="registerDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                            <FormControl><Button variant={"outline"} className="w-full text-left font-normal border-muted-foreground/20">{field.value ? format(field.value, "d 'de' MMMM, yyyy", { locale: es }) : "Elegir fecha"}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es}/></PopoverContent>
                      </Popover>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="campaign" render={({ field }) => (
                      <FormItem><FormLabel>Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select></FormItem>
                    )}/>
                    <FormField control={form.control} name="stage" render={({ field }) => (
                      <FormItem><FormLabel>Etapa</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl><SelectContent><SelectItem value="habilitacion">Habilitacion</SelectItem><SelectItem value="produccion">Produccion</SelectItem></SelectContent></Select></FormItem>
                    )}/>
                    <FormField control={form.control} name="lote" render={({ field }) => (
                      <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione"/></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.lote}</SelectItem>)}</SelectContent></Select></FormItem>
                    )}/>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem className="col-span-1"><FormLabel>Cód.</FormLabel><FormControl><Input placeholder="31" {...field} className="text-center font-bold"/></FormControl></FormItem>
                  )}/>
                  <FormField control={form.control} name="labor" render={({ field }) => (
                    <FormItem className="col-span-3"><FormLabel>Labor</FormLabel><FormControl><Input readOnly className="bg-muted font-medium" {...field} /></FormControl></FormItem>
                  )}/>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="cost" render={({ field }) => (<FormItem><FormLabel>S/ Costo</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                    <FormField control={form.control} name="shift" render={({ field }) => (
                        <FormItem><FormLabel>Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="-"/></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem></SelectContent></Select></FormItem>
                    )}/>
                    <FormField control={form.control} name="pass" render={({ field }) => (<FormItem><FormLabel>Pasada</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)}/>
                </div>
            </CardContent>
         </Card>

         <Card className="shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between py-3">
                <CardTitle className="text-md flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" /> Detalle de Asistentes</CardTitle>
                <Badge variant="outline" className="bg-background">{groupActivities.length} Miembros</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                  <Table>
                      <TableHeader className="bg-muted/30">
                          <TableRow>
                              <TableHead className="font-bold">Asistente</TableHead>
                              <TableHead className="w-24 text-center font-bold">{performanceLabel}</TableHead>
                              {showExtraPerformanceField && <TableHead className="w-24 text-center font-bold">{extraPerformanceLabel}</TableHead>}
                              <TableHead className="w-20 text-center font-bold">JHU</TableHead>
                              <TableHead className="w-10"></TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {groupActivities.map((act, idx) => (
                              <TableRow key={act.id} className="hover:bg-muted/20">
                                  <TableCell className="text-xs font-medium py-2">{act.assistantName}</TableCell>
                                  <TableCell className="py-2"><Input type="number" value={act.performance || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, performance: Number(e.target.value)} : a))} className="h-8 text-center text-xs"/></TableCell>
                                  {showExtraPerformanceField && <TableCell className="py-2"><Input type="number" value={act.clustersOrJabas || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, clustersOrJabas: Number(e.target.value)} : a))} className="h-8 text-center text-xs"/></TableCell>}
                                  <TableCell className="py-2"><Input type="number" step="0.1" value={act.workdayCount || ''} onChange={e => setGroupActivities(prev => prev.map((a, i) => i === idx ? {...a, workdayCount: Number(e.target.value)} : a))} className="h-8 text-center text-xs"/></TableCell>
                                  <TableCell className="py-2"><Button variant="ghost" size="icon" onClick={() => setGroupActivities(prev => prev.filter(a => a.id !== act.id))} className="h-8 w-8"><Trash2 className="h-4 text-destructive"/></Button></TableCell>
                              </TableRow>
                          ))}
                          {groupActivities.length === 0 && (
                            <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No hay asistentes agregados.</TableCell></TableRow>
                          )}
                      </TableBody>
                      {groupActivities.length > 0 && (
                        <TableFooter>
                            <TableRow className="bg-muted/50 font-bold text-xs sm:text-sm">
                                <TableCell className="text-right">Total</TableCell>
                                <TableCell className="text-center">{groupActivities.reduce((sum, a) => sum + (Number(a.performance) || 0), 0).toLocaleString('es-PE')}</TableCell>
                                {showExtraPerformanceField && <TableCell className="text-center">{groupActivities.reduce((sum, a) => sum + (Number(a.clustersOrJabas) || 0), 0).toLocaleString('es-PE')}</TableCell>}
                                <TableCell className="text-center">{groupActivities.reduce((sum, a) => sum + (Number(a.workdayCount) || 0), 0).toFixed(1)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableFooter>
                      )}
                  </Table>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 p-4 gap-3 border-t">
                <Button variant="outline" type="button" onClick={() => setIsAddAssistantDialogOpen(true)} className="flex-1 border-primary/20 hover:bg-primary/5"><PlusCircle className="mr-2 h-4"/>Añadir Asistente</Button>
                <Button variant="outline" type="button" onClick={() => handleCaptureTable(groupActivities, form.getValues())} disabled={groupActivities.length === 0} className="border-primary/20 hover:bg-primary/5"><Camera className="mr-2 h-4"/>Captura</Button>
            </CardFooter>
         </Card>

         <Button type="button" onClick={handleGroupSave} className="w-full h-14 text-xl font-bold shadow-xl rounded-2xl" disabled={isPending || groupActivities.length === 0}>
            {isPending ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
            Guardar Todo el Grupo
         </Button>

         <AddAssistantActivityDialog
            isOpen={isAddAssistantDialogOpen}
            setIsOpen={setIsAddAssistantDialogOpen}
            onSelectAssistant={(a) => setGroupActivities(prev => [...prev, { ...a, id: crypto.randomUUID(), performance: 0, workdayCount: 0 }])}
            currentAssistantsDnis={groupActivities.map(f => f.assistantDni)}
        />

        {/* Renderizado oculto para la captura de pantalla profesional */}
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <div ref={reportRef}>
            <CaptureReport 
              activities={groupActivities} 
              header={form.getValues()} 
              showExtraPerformanceField={showExtraPerformanceField}
              performanceLabel={performanceLabel}
              extraPerformanceLabel={extraPerformanceLabel}
              loteLabel={uniqueLotes.find((l: any) => l.id === form.getValues('lote'))?.lote || ''}
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
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

  const handleCaptureTable = async (groupActivities: any[], headerValues: any) => {
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

  const getLabels = (code: string) => {
    const showExtra = ['46', '67'].includes(String(code) || '');
    return {
      showExtra,
      performanceLabel: showExtra ? "Rdto (Plta)" : "Rendimiento",
      extraLabel: String(code) === '46' ? "Racimos" : "Jabas"
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      <div className="flex items-center justify-center space-x-4 p-3 bg-muted rounded-xl w-fit mx-auto shadow-inner">
          <Label className={cn("text-sm transition-all", formMode === 'individual' ? "font-bold text-primary scale-105" : "text-muted-foreground")}>Individual</Label>
          <Switch checked={formMode === 'group'} onCheckedChange={(c) => setFormMode(c ? 'group' : 'individual')} />
          <Label className={cn("text-sm transition-all", formMode === 'group' ? "font-bold text-primary scale-105" : "text-muted-foreground")}>Grupal</Label>
      </div>

      {formMode === 'individual' ? (
        <IndividualActivityForm 
          profile={profile} 
          labors={labors} 
          uniqueLotes={uniqueLotes} 
          lotes={lotes}
          {...getLabels('')} // Actualizado dinámicamente dentro del componente
        />
      ) : (
        <GroupActivityForm 
          profile={profile} 
          labors={labors} 
          uniqueLotes={uniqueLotes} 
          lotes={lotes}
          reportRef={reportRef}
          handleCaptureTable={handleCaptureTable}
          {...getLabels('')}
        />
      )}
    </div>
  );
}
