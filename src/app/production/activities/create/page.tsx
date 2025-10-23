
'use client';

import { useEffect, useMemo, useTransition, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
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
  User,
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
});

type GroupFormValues = z.infer<typeof groupFormSchema>;


const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">{children}</div>
);

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
  
  const [groupActivities, setGroupActivities] = useState<GroupActivityRow[]>([]);
  const [isAddActivityDialogOpen, setAddActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<GroupActivityRow | null>(null);

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
      campaign: '',
      stage: '',
      lote: '',
      code: '',
      labor: '',
      shift: '',
      pass: '',
      cost: '',
    },
  });
  
  const singleCodeValue = useWatch({ control: singleForm.control, name: 'code' });
  const groupCodeValue = useWatch({ control: groupForm.control, name: 'code' });
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
    const activeForm = formMode === 'individual' ? singleForm : groupForm;
    if (codeValue) {
      const matchedLabor = labors.find(l => String(l.codigo) === String(codeValue));
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
  
  const showExtraPerformanceField = useMemo(() => ['46', '67'].includes(String(codeValue) || ''), [codeValue]);
  const performanceLabel = showExtraPerformanceField ? "Plantas" : "Rendimiento";
  const extraPerformanceLabel = String(codeValue) === '46' ? "Racimos" : "Jabas";
  const ExtraPerformanceIcon = String(codeValue) === '46' ? Grape : Boxes;

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
        for (const activity of groupActivities) {
            const fullActivityData: SingleActivityFormValues = {
                ...activity,
                registerDate: data.registerDate,
                campaign: data.campaign,
                stage: data.stage || '',
                lote: data.lote,
                code: data.code,
                labor: data.labor,
                shift: data.shift,
                pass: data.pass || 0,
                cost: data.cost || 0,
                createdBy: user?.email || '',
                performance: activity.performance || 0,
                workdayCount: activity.workdayCount || 0
            };
            const result = await saveActivity(fullActivityData);
            if (result.success) {
                successCount++;
            }
        }

        if (successCount === groupActivities.length) {
             toast({
                title: 'Éxito',
                description: `${successCount} fichas de actividad han sido guardadas.`,
            });
            groupForm.reset();
            setGroupActivities([]);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error Parcial',
                description: `Se guardaron ${successCount} de ${groupActivities.length} fichas. Por favor, revise los datos.`,
            });
        }
    });
  };

  const handleAddActivity = (newActivity: GroupActivityRow) => {
    if (editingActivity) {
      setGroupActivities(prev => prev.map(act => act.id === editingActivity.id ? newActivity : act));
      setEditingActivity(null);
    } else {
      setGroupActivities(prev => [...prev, newActivity]);
    }
  };

  const handleEditActivity = (activity: GroupActivityRow) => {
    setEditingActivity(activity);
    setAddActivityDialogOpen(true);
  }

  const handleRemoveActivity = (id: string) => {
    setGroupActivities(prev => prev.filter(act => act.id !== id));
  };


  const totals = useMemo(() => {
    if (!groupActivities) return { performance: 0, personnelCount: 0, workdayCount: 0, minRange: 0, maxRange: 0, clustersOrJabas: 0 };
    
    const totals = groupActivities.reduce((acc, curr) => {
      acc.performance += Number(curr.performance) || 0;
      acc.clustersOrJabas += Number(curr.clustersOrJabas) || 0;
      acc.personnelCount += Number(curr.personnelCount) || 0;
      acc.workdayCount += Number(curr.workdayCount) || 0;
      return acc;
    }, { performance: 0, personnelCount: 0, workdayCount: 0, clustersOrJabas: 0 });

    const minValues = groupActivities.map(a => Number(a.minRange)).filter(v => v > 0);
    const maxValues = groupActivities.map(a => Number(a.maxRange)).filter(v => v > 0);
    
    return {
      ...totals,
      minRange: minValues.length > 0 ? Math.min(...minValues) : 0,
      maxRange: maxValues.length > 0 ? Math.max(...maxValues) : 0,
    }
  }, [groupActivities]);

  const renderSharedHeader = (form: any) => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
        <FormField control={form.control} name="registerDate" render={({ field }) => (<FormItem><FormLabel className="font-semibold">Fecha</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button size="sm" variant="outline" className="font-normal w-full justify-start h-8">{field.value ? format(field.value, 'P', { locale: es }) : <span>Elige</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover></FormItem>)}/>
        <FormField control={form.control} name="lote" render={({ field }) => (<FormItem><FormLabel className="font-semibold">Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8"><SelectValue /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.lote}>{lote.lote}</SelectItem>)}</SelectContent></Select></FormItem>)} />
        <FormField control={form.control} name="campaign" render={({ field }) => (<FormItem><FormLabel className="font-semibold">Campaña</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent></Select></FormItem>)} />
        <FormField control={form.control} name="cost" render={({ field }) => (<FormItem><FormLabel className="font-semibold">Costo</FormLabel><FormControl><Input className="h-8" type="number" {...field} /></FormControl></FormItem>)} />
        <FormField control={form.control} name="pass" render={({ field }) => (<FormItem><FormLabel className="font-semibold">Pasada</FormLabel><FormControl><Input className="h-8" type="number" {...field} /></FormControl></FormItem>)} />
        <FormField control={form.control} name="shift" render={({ field }) => (<FormItem><FormLabel className="font-semibold">Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Elegir..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem><SelectItem value="Noche">Noche</SelectItem></SelectContent></Select></FormItem>)} />
      </div>
      <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm items-end">
        <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel className="font-semibold">Cod Labor</FormLabel><FormControl><Input className="h-8" {...field} /></FormControl></FormItem>)} />
        <FormField control={form.control} name="labor" render={({ field }) => (<FormItem className="col-span-3"><FormLabel className="font-semibold">Labor</FormLabel><FormControl><Input className="h-8" {...field} readOnly /></FormControl></FormItem>)} />
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
                         <FormItem> <FormLabel><IconWrapper><User className="h-4 w-4" /> Asistente</IconWrapper></FormLabel><FormControl><Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger><SelectContent>{asistentes.map(a => <SelectItem key={a.id} value={a.id}>{a.assistantName}</SelectItem>)}</SelectContent></Select></FormControl><FormMessage /></FormItem>
                      )}/>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                          <FormField control={singleForm.control} name="performance" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><TrendingUp className="h-4 w-4" /> {performanceLabel}</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                          {showExtraPerformanceField && (
                              <FormField control={singleForm.control} name="clustersOrJabas" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><ExtraPerformanceIcon className="h-4 w-4" /> {extraPerformanceLabel}</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                          )}
                          <FormField control={singleForm.control} name="personnelCount" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><Users className="h-4 w-4" /> # Personas</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="1" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                          <FormField control={singleForm.control} name="workdayCount" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><ClipboardList className="h-4 w-4" /> # Jornadas (JHU)</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                          <FormField control={singleForm.control} name="minRange" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><FileInput className="h-4 w-4" /> Min</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                          <FormField control={singleForm.control} name="maxRange" render={({ field }) => ( <FormItem> <FormLabel><IconWrapper><FileOutput className="h-4 w-4"/> Max</IconWrapper></FormLabel> <FormControl><Input type="number" placeholder="" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
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
            <form onSubmit={groupForm.handleSubmit(onGroupSubmit)} className="space-y-6">
               <div className="rounded-lg border bg-background p-6 shadow-sm space-y-6">
                    <div className="space-y-4">
                        {renderSharedHeader(groupForm)}
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
                                {groupActivities.map((activity) => (
                                <TableRow key={activity.id}>
                                    <TableCell>{activity.assistantName}</TableCell>
                                    <TableCell>{activity.performance}</TableCell>
                                    {showExtraPerformanceField && <TableCell>{activity.clustersOrJabas}</TableCell>}
                                    <TableCell>{activity.personnelCount}</TableCell>
                                    <TableCell>{activity.workdayCount}</TableCell>
                                    <TableCell>{activity.minRange}</TableCell>
                                    <TableCell>{activity.maxRange}</TableCell>
                                    <TableCell>{activity.observations}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex gap-1 justify-center">
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditActivity(activity)}><Pencil className="h-4 w-4 text-blue-600"/></Button>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveActivity(activity.id)} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold text-right">Total</TableCell>
                                    <TableCell className="font-bold text-center">{formatAssistantName(totals.performance.toLocaleString('es-PE'))}</TableCell>
                                    {showExtraPerformanceField && <TableCell className="font-bold text-center">{totals.clustersOrJabas.toLocaleString('es-PE')}</TableCell>}
                                    <TableCell className="font-bold text-center">{totals.personnelCount}</TableCell>
                                    <TableCell className="font-bold text-center">{totals.workdayCount.toFixed(1)}</TableCell>
                                    <TableCell className="font-bold text-center">{totals.minRange}</TableCell>
                                    <TableCell className="font-bold text-center">{totals.maxRange}</TableCell>
                                    <TableCell colSpan={2}></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => { setEditingActivity(null); setAddActivityDialogOpen(true); }}>
                            <PlusCircle className="mr-2 h-4 w-4"/> Agregar Fila
                        </Button>
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isPending || masterLoading || groupActivities.length === 0}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
          onAddActivity={handleAddActivity}
          currentAssistantsDnis={groupActivities.map(a => a.assistantDni)}
          showExtraPerformanceField={showExtraPerformanceField}
          performanceLabel={performanceLabel}
          extraPerformanceLabel={extraPerformanceLabel}
          ExtraPerformanceIcon={ExtraPerformanceIcon}
          existingActivity={editingActivity}
       />
    </>
  );
}
