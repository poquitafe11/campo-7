
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Code,
  Wrench,
  Save,
  Sprout,
  PlusCircle,
  Trash2,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { type Assistant, type Labor, type LoteData, type AttendanceRecord, type JaladorAttendance } from '@/lib/types';
import AddAssistantDialog from '@/components/AddAssistantDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { db, auth } from '@/lib/firebase';
import { collection, doc, runTransaction, getDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { useMasterData } from '@/context/MasterDataContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';

const assistantInFormSchema = z.object({
  id: z.string(),
  assistantDni: z.string(),
  assistantName: z.string(),
  jaladores: z.array(z.object({
    id: z.string(),
    jaladorId: z.string(),
    jaladorAlias: z.string(),
    personnelCount: z.number(),
    absentCount: z.number(),
    supportedLabor: z.string().optional(),
  })),
  personnelCount: z.number().optional(), // Make optional as it will be derived from jaladores
  absentCount: z.number().optional(), // Make optional as it will be derived from jaladores
});


const attendanceFormSchema = z.object({
  date: z.date({
    required_error: 'La fecha es obligatoria.',
  }),
  lote: z.string().min(1, 'Debe seleccionar un lote.'),
  code: z.string().optional(),
  labor: z.string().optional(),
  assistants: z.array(assistantInFormSchema),
});

type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;


export default function DailyEntryPage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddAssistantDialogOpen, setIsAddAssistantDialogOpen] = useState(false);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const { labors, lotes, asistentes: masterAssistants, loading: masterLoading } = useMasterData();
  const [laborsOnSameDay, setLaborsOnSameDay] = useState<Labor[]>([]);
  
  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      date: new Date(), 
      lote: '',
      code: '',
      labor: '',
      assistants: [],
    },
  });

  const codeValue = useWatch({ control: form.control, name: 'code' });
  const loteIdValue = useWatch({ control: form.control, name: 'lote' });
  const laborValue = useWatch({ control: form.control, name: 'labor' });
  const dateValue = useWatch({ control: form.control, name: 'date' });


  const selectedLoteData = useMemo(() => {
    return lotes.find(l => l.id === loteIdValue);
  }, [loteIdValue, lotes]);

  const uniqueLotes = useMemo(() => {
    const lotesMap = new Map<string, LoteData>();
    lotes.forEach(lote => {
      if (!lotesMap.has(lote.lote)) {
        lotesMap.set(lote.lote, lote);
      }
    });
    return Array.from(lotesMap.values());
  }, [lotes]);

  const totals = useMemo(() => {
    return assistants.reduce(
      (acc, assistant) => {
        const jaladorTotals = assistant.jaladores.reduce((jAcc, j) => {
            jAcc.personnelCount += Number(j.personnelCount) || 0;
            jAcc.absentCount += Number(j.absentCount) || 0;
            return jAcc;
        }, { personnelCount: 0, absentCount: 0 });
        acc.personnelCount += jaladorTotals.personnelCount;
        acc.absentCount += jaladorTotals.absentCount;
        return acc;
      },
      { personnelCount: 0, absentCount: 0 }
    );
  }, [assistants]);
  
  useEffect(() => {
    setActions({ title: "Registro de Asistencia" });
    return () => setActions({});
  }, [setActions]);

  useEffect(() => {
    if (codeValue) {
      const matchedLabor = labors.find(l => l.codigo === codeValue);
      if (matchedLabor) {
        form.setValue('labor', matchedLabor.descripcion, { shouldValidate: true });
      } else {
        form.setValue('labor', '', { shouldValidate: true });
      }
    } else {
        if (!form.getValues('labor')) {
            form.setValue('labor', '', { shouldValidate: true });
        }
    }
  }, [codeValue, labors, form]);

  const fetchLaborsOnSameDay = useCallback(async () => {
    if (!loteIdValue || !dateValue) {
      setLaborsOnSameDay([]);
      return;
    }
    const dateStr = format(dateValue, 'yyyy-MM-dd');
    const q = query(
      collection(db, 'asistencia'),
      where('date', '==', dateStr),
      where('lote', '==', loteIdValue)
    );
    const querySnapshot = await getDocs(q);
    const laborsSet = new Set<string>();
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if(data.labor && data.code !== '903') { // Exclude assistants labor itself
        laborsSet.add(data.labor);
      }
    });
    const laborsData = labors.filter(l => laborsSet.has(l.descripcion));
    setLaborsOnSameDay(laborsData);
  }, [dateValue, loteIdValue, labors]);
  
  useEffect(() => {
    fetchLaborsOnSameDay();
  }, [fetchLaborsOnSameDay]);


  useEffect(() => {
    form.setValue('assistants', assistants, { shouldValidate: true });
  }, [assistants, form]);
  
  useEffect(() => {
    // Automatically add all assistants if code is 902 and a lot is selected
    if (codeValue === '902' && selectedLoteData) {
      const existingAssistants = new Set(assistants.map(a => a.assistantDni));
      const allMasterAssistants = masterAssistants.filter(ma => !existingAssistants.has(ma.id));

      if (allMasterAssistants.length > 0) {
        const newAssistantsToAdd = allMasterAssistants.map(ma => ({
          id: crypto.randomUUID(),
          assistantDni: ma.id,
          assistantName: ma.assistantName,
          personnelCount: 0,
          absentCount: 0,
          jaladores: []
        }));
        setAssistants(prev => [...prev, ...newAssistantsToAdd]);
        toast({ title: "Asistentes Cargados", description: `Se agregaron ${allMasterAssistants.length} asistentes a la lista.`});
      }
    }
  }, [codeValue, selectedLoteData, masterAssistants, assistants, toast]);

  const handleAddAssistant = (newAssistant: Omit<Assistant, 'id'>) => {
    if (!selectedLoteData || !laborValue) return;

    const personnelCount = newAssistant.jaladores.reduce((sum, j) => sum + (Number(j.personnelCount) || 0), 0);
    const absentCount = newAssistant.jaladores.reduce((sum, j) => sum + (Number(j.absentCount) || 0), 0);
    
    setAssistants((prev) => [
      ...prev,
      { 
        ...newAssistant, 
        id: crypto.randomUUID(),
        personnelCount,
        absentCount
      },
    ]);
  };


  const handleDeleteAssistant = (id: string) => {
    setAssistants((prev) => prev.filter((a) => a.id !== id));
  };
  
  async function onSubmit(data: AttendanceFormValues, isAutoSubmit = false) {
    setIsSubmitting(true);
    if (!db || !auth?.currentUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'No estás autenticado o no hay conexión.' });
        setIsSubmitting(false);
        return;
    }
    
    const assistantsToSave = isAutoSubmit ? data.assistants : assistants;
    
    if (assistantsToSave.length === 0) {
        toast({ variant: 'destructive', title: 'Lista Vacía', description: 'Añade al menos un asistente a la lista antes de guardar.' });
        setIsSubmitting(false);
        return;
    }

    const attendanceCollectionRef = collection(db, 'asistencia');
    
    const loteMasterData = lotes.find(l => l.id === data.lote);
    if (!loteMasterData) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el lote maestro seleccionado.' });
        setIsSubmitting(false);
        return;
    }
    const laborMasterData = labors.find(l => l.descripcion === data.labor || l.codigo === data.code);
    const laborCode = laborMasterData?.codigo || '';
    const laborDesc = laborMasterData?.descripcion || data.labor || '';

    const docId = `${format(data.date, 'yyyy-MM-dd')}-${loteMasterData.lote}-${laborDesc}`.replace(/\s+/g, '-');
    const docRef = doc(attendanceCollectionRef, docId);

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            
            const assistantsPayload = assistantsToSave.map(a => {
                const jaladores = (a.jaladores || []).map(j => {
                    const jaladorData: Partial<JaladorAttendance> = {
                        id: j.id,
                        jaladorId: j.jaladorId,
                        jaladorAlias: j.jaladorAlias,
                        personnelCount: j.personnelCount,
                        absentCount: j.absentCount,
                    };
                    if (j.supportedLabor) {
                        jaladorData.supportedLabor = j.supportedLabor;
                    }
                    return jaladorData as JaladorAttendance;
                });
                return {
                    id: a.id,
                    assistantDni: a.assistantDni,
                    assistantName: a.assistantName,
                    jaladores: jaladores,
                };
            });

            if (docSnap.exists()) {
                const existingData = docSnap.data() as AttendanceRecord;
                const existingAssistants = existingData.assistants || [];
                
                const combinedAssistants = [...existingAssistants];
                assistantsPayload.forEach(newAssistant => {
                    if (!combinedAssistants.some(ea => ea.assistantDni === newAssistant.assistantDni)) {
                        combinedAssistants.push(newAssistant);
                    }
                });

                const newTotals = combinedAssistants.reduce((acc, a) => {
                    const assistantTotals = (a.jaladores || []).reduce((jAcc, j) => {
                        jAcc.personnelCount += j.personnelCount;
                        jAcc.absentCount += j.absentCount;
                        return jAcc;
                    }, {personnelCount: 0, absentCount: 0});
                    acc.personnelCount += assistantTotals.personnelCount;
                    acc.absentCount += assistantTotals.absentCount;
                    return acc;
                }, { personnelCount: 0, absentCount: 0 });

                transaction.update(docRef, {
                    assistants: combinedAssistants,
                    totals: newTotals,
                    lastModifiedBy: auth.currentUser?.email,
                    lastModifiedAt: serverTimestamp(),
                });

            } else {
                const recordTotals = assistantsPayload.reduce((acc, a) => {
                    const assistantTotals = (a.jaladores || []).reduce((jAcc, j) => {
                        jAcc.personnelCount += j.personnelCount;
                        jAcc.absentCount += j.absentCount;
                        return jAcc;
                    }, {personnelCount: 0, absentCount: 0});
                    acc.personnelCount += assistantTotals.personnelCount;
                    acc.absentCount += assistantTotals.absentCount;
                    return acc;
                }, { personnelCount: 0, absentCount: 0 });

                const record: Omit<AttendanceRecord, 'id'> = {
                    date: format(data.date, 'yyyy-MM-dd'),
                    lote: data.lote,
                    lotName: loteMasterData.lote,
                    variedad: loteMasterData.variedad,
                    fechaCianamida: loteMasterData.fechaCianamida,
                    campana: loteMasterData.campana,
                    code: laborCode,
                    labor: laborDesc,
                    assistants: assistantsPayload,
                    totals: recordTotals,
                    registeredBy: auth.currentUser?.email,
                    createdAt: serverTimestamp(),
                    lastModifiedBy: auth.currentUser?.email,
                    lastModifiedAt: serverTimestamp(),
                };
                transaction.set(docRef, record);
            }
        });
        
        toast({
            title: "Operación Completada",
            description: `Registro guardado/actualizado con éxito.`,
        });

        fetchLaborsOnSameDay();

        form.reset({
          date: new Date(),
          lote: '',
          code: '',
          labor: '',
          assistants: [],
        });
        setAssistants([]);

    } catch (error: any) {
         console.error("Error en transacción de guardado:", error);
         toast({ variant: 'destructive', title: "Error", description: error.message || `No se pudo guardar el registro.` });
    } finally {
      setIsSubmitting(false);
    }
  }

  const canAddAssistant = !!loteIdValue && !!laborValue;


  return (
    <div className="p-4 space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => onSubmit(data, false))} className="space-y-6">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" /> Fecha
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={'outline'}
                        className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                      >
                        {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                        initialFocus
                        locale={es}
                      />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lote"
            render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Sprout className="h-4 w-4" /> Lote
              </FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecciona un lote" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {uniqueLotes
                     .sort((a,b) => a.lote.localeCompare(b.lote, undefined, {numeric: true}))
                     .map((lote) => <SelectItem key={lote.id} value={lote.id}>{lote.lote}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
            )}
          />

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Code className="h-4 w-4" /> Cód.</FormLabel>
                  <FormControl><Input placeholder="Ej: 1001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="labor"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Labor</FormLabel>
                  <FormControl><Input placeholder="Labor (auto-completado)" {...field} readOnly /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {assistants.length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asistente</TableHead>
                        <TableHead className="text-center">Personal</TableHead>
                        <TableHead className="text-center">Faltos</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assistants.map((assistant) => {
                            const assistantTotals = assistant.jaladores.reduce((acc, j) => {
                                acc.personnelCount += Number(j.personnelCount) || 0;
                                acc.absentCount += Number(j.absentCount) || 0;
                                return acc;
                            }, { personnelCount: 0, absentCount: 0 });

                            return (
                                <Collapsible asChild key={assistant.id}>
                                    <TableRow>
                                        <TableCell colSpan={4} className="p-0">
                                            <div className="flex items-center w-full">
                                                <CollapsibleTrigger asChild>
                                                  <div className="flex-1 p-4 cursor-pointer hover:bg-muted/50">
                                                    <div className="flex items-center gap-2 w-full text-left">
                                                      <span className="font-medium truncate">{assistant.assistantName}</span>
                                                      <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                                                    </div>
                                                  </div>
                                                </CollapsibleTrigger>
                                                <div className="w-24 text-center">{assistantTotals.personnelCount}</div>
                                                <div className="w-24 text-center">{assistantTotals.absentCount}</div>
                                                <div className="w-24 text-right pr-4">
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAssistant(assistant.id)}>
                                                        <Trash2 className="h-4 w-4" /><span className="sr-only">Eliminar</span>
                                                    </Button>
                                                </div>
                                            </div>
                                            <CollapsibleContent>
                                                <div className="bg-muted/50 p-2 border-t">
                                                    <Table>
                                                        <TableHeader><TableRow><TableHead className="h-8">Jalador</TableHead><TableHead className="h-8 text-center">Personal</TableHead><TableHead className="h-8 text-center">Faltos</TableHead></TableRow></TableHeader>
                                                        <TableBody>
                                                            {assistant.jaladores.map(j => (
                                                                <TableRow key={j.id}><TableCell>{j.jaladorAlias}</TableCell><TableCell className="text-center">{j.personnelCount}</TableCell><TableCell className="text-center">{j.absentCount}</TableCell></TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CollapsibleContent>
                                        </TableCell>
                                    </TableRow>
                                </Collapsible>
                            )
                        })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="text-right font-bold">Total</TableCell>
                        <TableCell className="font-bold text-center">{totals.personnelCount}</TableCell>
                        <TableCell className="font-bold text-center">{totals.absentCount}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
              </CardContent>
            </Card>
          )}
          
          <div className="flex flex-col gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting || assistants.length === 0} className="w-full">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddAssistantDialogOpen(true)}
              disabled={!canAddAssistant}
              title={!canAddAssistant ? 'Debes seleccionar un lote y una labor primero' : ''}
              className="w-full"
            >
              <PlusCircle className="mr-2 h-4 w-4" />Agregar Asistente y Personal
            </Button>
          </div>
        </form>
      </Form>
      <AddAssistantDialog
        isOpen={isAddAssistantDialogOpen}
        setIsOpen={setIsAddAssistantDialogOpen}
        onAddAssistant={handleAddAssistant}
        currentAssistantsDnis={assistants.map(a => a.assistantDni)}
        isAssistantLabor={codeValue === '903'}
        laborsOnSameDay={laborsOnSameDay}
      />
    </div>
  );
}
