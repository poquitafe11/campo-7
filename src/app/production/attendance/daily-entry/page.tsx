"use client";

import { useEffect, useState, useMemo } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { collection, doc, runTransaction, getDoc } from 'firebase/firestore';
import { useMasterData } from '@/context/MasterDataContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  }))
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddAssistantDialogOpen, setIsAddAssistantDialogOpen] = useState(false);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const { labors, lotes, loading: masterLoading } = useMasterData();
  const [userProfile, setUserProfile] = useState<{ nombre: string } | null>(null);
  
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

  const codeValue = form.watch('code');
  const loteIdValue = form.watch('lote');
  const laborValue = form.watch('labor');

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
        const assistantTotals = assistant.jaladores.reduce((asistAcc, jalador) => {
            asistAcc.personnelCount += jalador.personnelCount;
            asistAcc.absentCount += jalador.absentCount;
            return asistAcc;
        }, { personnelCount: 0, absentCount: 0 });
        
        acc.personnelCount += assistantTotals.personnelCount;
        acc.absentCount += assistantTotals.absentCount;
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
     const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser && db) {
            const userDocRef = doc(db, 'usuarios', currentUser.email!);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                setUserProfile(userDocSnap.data() as { nombre: string });
            } else {
                setUserProfile({ nombre: currentUser.email || 'Usuario' });
            }
        }
    });
    return () => unsubscribe();
  }, [toast]);
  
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

  useEffect(() => {
    form.setValue('assistants', assistants, { shouldValidate: true });
  }, [assistants, form]);

  const handleAddAssistant = (newAssistant: Omit<Assistant, 'id'>) => {
    if (!selectedLoteData || !laborValue) return;

    setAssistants((prev) => [
      ...prev,
      { 
        ...newAssistant, 
        id: new Date().toISOString() + Math.random(),
      },
    ]);
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

    const attendanceCollectionRef = collection(db, 'asistencia');
    let successfulSaves = 0;
    const failedSaves: string[] = [];

    const loteMasterData = lotes.find(l => l.id === data.lote);
    if (!loteMasterData) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el lote maestro seleccionado.' });
        setIsSubmitting(false);
        return;
    }
    const laborMasterData = labors.find(l => l.descripcion === data.labor);
    const laborCode = laborMasterData?.codigo || '';

    const docId = `${format(data.date, 'yyyy-MM-dd')}-${loteMasterData.lote}-${data.labor}`.replace(/\s+/g, '-');
    const docRef = doc(attendanceCollectionRef, docId);

    try {
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);

            if (docSnap.exists()) {
                // Document exists, update it by adding new assistants
                const existingData = docSnap.data() as AttendanceRecord;
                const existingAssistants = existingData.assistants || [];
                
                const newAssistantsToAdd = assistants.filter(newA => 
                    !existingAssistants.some(existA => existA.assistantDni === newA.assistantDni)
                );
                
                if (newAssistantsToAdd.length === 0) {
                    failedSaves.push(`Todos los asistentes para este lote y labor ya fueron registrados hoy.`);
                    return; // Exit transaction
                }

                const combinedAssistants = [...existingAssistants, ...newAssistantsToAdd];
                const newTotals = combinedAssistants.reduce((acc, a) => {
                    const assistantTotals = a.jaladores.reduce((jAcc, j) => {
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
                    totals: newTotals
                });

            } else {
                // Document doesn't exist, create it
                const record: Omit<AttendanceRecord, 'id'> = {
                    date: format(data.date, 'yyyy-MM-dd'),
                    lote: data.lote,
                    lotName: loteMasterData.lote,
                    variedad: loteMasterData.variedad,
                    fechaCianamida: loteMasterData.fechaCianamida,
                    campana: loteMasterData.campana,
                    code: laborCode,
                    labor: data.labor || '',
                    assistants: assistants,
                    totals: totals,
                    registeredBy: auth.currentUser?.email,
                };
                transaction.set(docRef, record);
            }
        });
        
        if (failedSaves.length === 0) {
            successfulSaves++;
        }

    } catch (error: any) {
         console.error("Error en transacción de guardado:", error);
         failedSaves.push(error.message || `No se pudo guardar el registro.`);
    }

    if (successfulSaves > 0) {
         toast({
            title: "Operación Completada",
            description: `Registro guardado/actualizado con éxito.`,
        });
    }

    if (failedSaves.length > 0) {
        toast({
            variant: "destructive",
            title: "Algunos Registros Fallaron",
            description: failedSaves.join(' '),
        });
    }

    if (successfulSaves > 0) {
        form.reset({
          date: new Date(),
          lote: '',
          code: '',
          labor: '',
          assistants: [],
        });
        setAssistants([]);
    }
    
    setIsSubmitting(false);
  }

  const canAddAssistant = !!loteIdValue && !!laborValue;


  return (
    <div className="p-4 space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <TableHead>Personas</TableHead>
                        <TableHead>Faltos</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assistants.map((assistant) => {
                        const assistantTotals = assistant.jaladores.reduce((acc, j) => {
                            acc.personnelCount += j.personnelCount;
                            acc.absentCount += j.absentCount;
                            return acc;
                        }, { personnelCount: 0, absentCount: 0 });

                        return(
                        <Collapsible asChild key={assistant.id}>
                          <>
                            <TableRow>
                              <TableCell className="font-medium truncate">
                                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                                  {assistant.assistantName}
                                  <ChevronDown className="h-4 w-4" />
                                </CollapsibleTrigger>
                              </TableCell>
                              <TableCell>{assistantTotals.personnelCount}</TableCell>
                              <TableCell>{assistantTotals.absentCount}</TableCell>
                              <TableCell className="text-right">
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAssistant(assistant.id)}>
                                  <Trash2 className="h-4 w-4" /><span className="sr-only">Eliminar</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild>
                              <tr className="bg-muted/50">
                                <td colSpan={4} className="p-0">
                                  <div className="p-2">
                                     <Table>
                                        <TableHeader><TableRow><TableHead className="h-8">Jalador</TableHead><TableHead className="h-8">Personal</TableHead><TableHead className="h-8">Faltos</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                          {assistant.jaladores.map(j => (
                                            <TableRow key={j.id}><TableCell>{j.jaladorAlias}</TableCell><TableCell>{j.personnelCount}</TableCell><TableCell>{j.absentCount}</TableCell></TableRow>
                                          ))}
                                        </TableBody>
                                     </Table>
                                  </div>
                                </td>
                              </tr>
                            </CollapsibleContent>
                           </>
                        </Collapsible>
                      )})}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="text-right font-bold">Total</TableCell>
                        <TableCell className="font-bold">{totals.personnelCount}</TableCell>
                        <TableCell className="font-bold">{totals.absentCount}</TableCell>
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
      />
    </div>
  );
}