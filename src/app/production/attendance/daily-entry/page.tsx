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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { type Assistant, type Labor, type LoteData, type AttendanceRecord } from '@/lib/types';
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
import { collection, doc, setDoc, getDoc, query, where, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useMasterData } from '@/context/MasterDataContext';
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
  personnelCount: z.number().optional(),
  absentCount: z.number().optional(),
});

const attendanceFormSchema = z.object({
  date: z.date({
    required_error: 'La fecha es obligatoria.',
  }),
  lote: z.string().min(1, 'Debe seleccionar un lote.'),
  turno: z.string().min(1, 'Debe seleccionar un turno.'),
  code: z.string().optional(),
  labor: z.string().optional(),
  assistants: z.array(assistantInFormSchema),
});

type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

export default function DailyEntryPage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddAssistantDialogOpen, setIsAddAssistantDialogOpen] = useState(false);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const { labors, lotes, loading: masterLoading } = useMasterData();
  const [laborsOnSameDay, setLaborsOnSameDay] = useState<Labor[]>([]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      date: new Date(), 
      lote: '',
      turno: '',
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
    const map = new Map<string, LoteData>();
    lotes.forEach(lote => {
      if (!map.has(lote.lote)) {
        map.set(lote.lote, lote);
      }
    });
    return Array.from(map.values());
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
    } else if (!form.getValues('labor')) {
        form.setValue('labor', '', { shouldValidate: true });
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
      if(data.labor && data.code !== '903') {
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
    if (codeValue === '902' && selectedLoteData && profile) {
        const currentUserDni = profile.dni;
        const currentUserName = profile.nombre;
        const alreadyExists = assistants.some(a => a.assistantDni === currentUserDni);
        if (!alreadyExists) {
            const newUserAssistant: Assistant = {
                id: crypto.randomUUID(),
                assistantDni: currentUserDni,
                assistantName: currentUserName,
                jaladores: [{
                    id: crypto.randomUUID(),
                    jaladorId: 'empresa',
                    jaladorAlias: 'Empresa',
                    personnelCount: 1,
                    absentCount: 0,
                }]
            };
            setAssistants(prev => [...prev, newUserAssistant]);
            toast({ title: "Asistencia de Supervisor", description: `Se agregó a ${currentUserName} con 1 persona.` });
        }
    }
  }, [codeValue, selectedLoteData, profile, assistants, toast]);

  const handleAddAssistant = (newAssistant: Omit<Assistant, 'id'>) => {
    if (!selectedLoteData || !laborValue) return;
    const personnelCount = newAssistant.jaladores.reduce((sum, j) => sum + (Number(j.personnelCount) || 0), 0);
    const absentCount = newAssistant.jaladores.reduce((sum, j) => sum + (Number(j.absentCount) || 0), 0);
    setAssistants((prev) => [...prev, { ...newAssistant, id: crypto.randomUUID(), personnelCount, absentCount }]);
  };

  const handleDeleteAssistant = (id: string) => {
    setAssistants((prev) => prev.filter((a) => a.id !== id));
  };
  
  async function onSubmit(data: AttendanceFormValues) {
    setIsSubmitting(true);
    if (!db || !auth?.currentUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'No estás autenticado o no hay conexión.' });
        setIsSubmitting(false);
        return;
    }
    if (assistants.length === 0) {
        toast({ variant: 'destructive', title: 'Lista Vacía', description: 'Añade al menos un asistente a la lista antes de guardar.' });
        setIsSubmitting(false);
        return;
    }
    const loteMasterData = lotes.find(l => l.id === data.lote);
    if (!loteMasterData) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el lote maestro seleccionado.' });
        setIsSubmitting(false);
        return;
    }
    const laborMasterData = labors.find(l => l.descripcion === data.labor || l.codigo === data.code);
    const laborCode = laborMasterData?.codigo || '';
    const laborDesc = laborMasterData?.descripcion || data.labor || '';
    const docId = `${format(data.date, 'yyyy-MM-dd')}-${loteMasterData.lote}-${laborDesc.replace(/[\s\/]/g, '-')}-${data.turno}`;
    const docRef = doc(db, 'asistencia', docId);

    try {
        const docSnap = await getDoc(docRef);
        let finalAssistants = assistants;
        if (docSnap.exists()) {
            const existingData = docSnap.data() as AttendanceRecord;
            const existingAssistants = existingData.assistants || [];
            const newAssistantsMap = new Map(assistants.map(a => [a.assistantDni, a]));
            const mergedAssistants = existingAssistants.map(exA => newAssistantsMap.has(exA.assistantDni) ? newAssistantsMap.get(exA.assistantDni)! : exA);
            newAssistantsMap.forEach((newA, dni) => {
                if (!mergedAssistants.some(a => a.assistantDni === dni)) mergedAssistants.push(newA);
            });
            finalAssistants = mergedAssistants;
        }
        const assistantsPayload = finalAssistants.map(a => ({
            id: a.id, assistantDni: a.assistantDni, assistantName: a.assistantName,
            jaladores: (a.jaladores || []).map(j => ({ id: j.id, jaladorId: j.jaladorId, jaladorAlias: j.jaladorAlias, personnelCount: j.personnelCount, absentCount: j.absentCount, supportedLabor: j.supportedLabor })),
        }));
        const recordTotals = assistantsPayload.reduce((acc, a) => {
            const jTotals = a.jaladores.reduce((jAcc, j) => { jAcc.personnelCount += j.personnelCount || 0; jAcc.absentCount += j.absentCount || 0; return jAcc; }, { personnelCount: 0, absentCount: 0 });
            acc.personnelCount += jTotals.personnelCount; acc.absentCount += jTotals.absentCount; return acc;
        }, { personnelCount: 0, absentCount: 0 });

        if (docSnap.exists()) {
             await updateDoc(docRef, { assistants: assistantsPayload, totals: recordTotals, lastModifiedBy: auth.currentUser.email, lastModifiedAt: serverTimestamp() });
        } else {
            await setDoc(docRef, { date: format(data.date, 'yyyy-MM-dd'), lote: data.lote, lotName: loteMasterData.lote, turno: data.turno, variedad: loteMasterData.variedad, fechaCianamida: loteMasterData.fechaCianamida, campana: loteMasterData.campana, code: laborCode, labor: laborDesc, assistants: assistantsPayload, totals: recordTotals, registeredBy: auth.currentUser.email, createdAt: serverTimestamp(), lastModifiedBy: auth.currentUser.email, lastModifiedAt: serverTimestamp() });
        }
        toast({ title: "Operación Completada", description: `Registro guardado con éxito.` });
        fetchLaborsOnSameDay();
        form.reset({ date: new Date(), lote: '', turno: '', code: '', labor: '', assistants: [] });
        setAssistants([]);
    } catch (error: any) {
         console.error("Error en transacción de guardado:", error);
         toast({ variant: 'destructive', title: "Error", description: error.message || `No se pudo guardar el registro.` });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-4 space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem className="flex flex-col"><FormLabel htmlFor="date-input" className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Fecha</FormLabel>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild><FormControl><Button id="date-input" name="date-input" variant={'outline'} className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>{field.value ? format(field.value, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(d) => { field.onChange(d); setIsCalendarOpen(false); }} disabled={(date) => date > new Date() || date < new Date('1900-01-01')} initialFocus locale={es}/></PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
         <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="lote" render={({ field }) => (
              <FormItem><FormLabel htmlFor="lote-select" className="flex items-center gap-2"><Sprout className="h-4 w-4" /> Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="lote-select" name="lote-select"><SelectValue placeholder="Selecciona un lote" /></SelectTrigger></FormControl><SelectContent>{uniqueLotes.sort((a,b) => a.lote.localeCompare(b.lote, undefined, {numeric: true})).map((lote) => <SelectItem key={lote.id} value={lote.id}>{lote.lote}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )}
            />
            <FormField control={form.control} name="turno" render={({ field }) => (
              <FormItem><FormLabel htmlFor="turno-select" className="flex items-center gap-2"><Clock className="h-4 w-4" /> Turno</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="turno-select" name="turno-select"><SelectValue placeholder="Selecciona un turno" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Mañana">Mañana</SelectItem><SelectItem value="Tarde">Tarde</SelectItem><SelectItem value="Noche">Noche</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )}
            />
         </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem><FormLabel htmlFor="code-input" className="flex items-center gap-2"><Code className="h-4 w-4" /> Cód.</FormLabel><FormControl><Input id="code-input" name="code-input" placeholder="Ej: 1001" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField control={form.control} name="labor" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel htmlFor="labor-input" className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Labor</FormLabel><FormControl><Input id="labor-input" name="labor-input" placeholder="Labor (auto-completado)" {...field} value={field.value || ''} readOnly /></FormControl><FormMessage /></FormItem>
              )}
            />
          </div>
          {assistants.length > 0 && (
            <Card className="mt-6"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Asistente</TableHead><TableHead className="text-center">Personal</TableHead><TableHead className="text-center">Faltos</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader><TableBody>{assistants.map((a) => { const aTotals = a.jaladores.reduce((acc, j) => { acc.personnelCount += Number(j.personnelCount) || 0; acc.absentCount += Number(j.absentCount) || 0; return acc; }, { personnelCount: 0, absentCount: 0 }); return (<TableRow key={a.id}><TableCell className="font-medium">{a.assistantName}</TableCell><TableCell className="text-center">{aTotals.personnelCount}</TableCell><TableCell className="text-center">{aTotals.absentCount}</TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAssistant(a.id)}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>) })}</TableBody><TableFooter><TableRow><TableCell className="text-right font-bold">Total</TableCell><TableCell className="font-bold text-center">{totals.personnelCount}</TableCell><TableCell className="font-bold text-center">{totals.absentCount}</TableCell><TableCell></TableCell></TableRow></TableFooter></Table></CardContent></Card>
          )}
          <div className="flex flex-col gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting || assistants.length === 0} className="w-full" id="submit-attendance-btn" name="submit-attendance-btn">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
            <Button type="button" variant="outline" onClick={() => setIsAddAssistantDialogOpen(true)} disabled={!loteIdValue || !laborValue} className="w-full" id="add-assistant-btn" name="add-assistant-btn"><PlusCircle className="mr-2 h-4 w-4" />Agregar Asistente y Personal</Button>
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
