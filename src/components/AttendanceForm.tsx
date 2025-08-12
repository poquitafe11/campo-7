"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { collection, doc, writeBatch, getDoc } from 'firebase/firestore';
import { useMasterData } from '@/context/MasterDataContext';

const assistantInFormSchema = z.object({
  id: z.string(),
  assistantName: z.string(),
  personnelCount: z.number(),
  absentCount: z.number(),
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

type StagedAssistant = Assistant & {
  loteId: string;
  loteName: string;
  labor: string;
};

export function AttendanceForm() {
  const { toast } = useToast();
  const [isAddAssistantDialogOpen, setIsAddAssistantDialogOpen] = useState(false);
  const [assistants, setAssistants] = useState<StagedAssistant[]>([]);
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
        acc.personnelCount += assistant.personnelCount;
        acc.absentCount += assistant.absentCount;
        return acc;
      },
      { personnelCount: 0, absentCount: 0 }
    );
  }, [assistants]);
  
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
    const assistantsForForm = assistants.map(({ labor, loteName, loteId, ...rest }) => rest);
    form.setValue('assistants', assistantsForForm, { shouldValidate: true });
  }, [assistants, form]);

  const handleAddAssistant = (newAssistant: Omit<Assistant, 'id'>) => {
    if (!selectedLoteData || !laborValue) return;

    setAssistants((prev) => [
      ...prev,
      { 
        ...newAssistant, 
        id: new Date().toISOString() + Math.random(),
        labor: laborValue,
        loteName: selectedLoteData.lote,
        loteId: selectedLoteData.id,
      },
    ]);
  };

  const handleDeleteAssistant = (id: string) => {
    setAssistants((prev) => prev.filter((a) => a.id !== id));
  };

  async function onSubmit(data: AttendanceFormValues) {
    if (!db || !auth?.currentUser) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No estás autenticado o no hay conexión.',
        });
        return;
    }
     if (assistants.length === 0) {
        toast({
            variant: 'destructive',
            title: 'Lista Vacía',
            description: 'Añade al menos un asistente a la lista antes de guardar.',
        });
        return;
    }

    try {
        const groupedByLotAndLabor = assistants.reduce((acc, assistant) => {
            const key = `${assistant.loteId}|${assistant.labor}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(assistant);
            return acc;
        }, {} as Record<string, StagedAssistant[]>);

        const batch = writeBatch(db);
        const attendanceCollection = collection(db, 'asistencia');
        const formattedDate = format(data.date, 'yyyy-MM-dd');

        for (const key in groupedByLotAndLabor) {
            const group = groupedByLotAndLabor[key];
            const [loteId, labor] = key.split('|');

            const groupTotals = group.reduce((acc, item) => {
                acc.personnelCount += item.personnelCount;
                acc.absentCount += item.absentCount;
                return acc;
            }, { personnelCount: 0, absentCount: 0 });

            const groupAssistants: Assistant[] = group.map(({ id, assistantName, personnelCount, absentCount }) => ({
                id,
                assistantName,
                personnelCount,
                absentCount,
            }));
            
            const loteMasterData = lotes.find(l => l.id === loteId);
            if (!loteMasterData) continue;

            const laborMasterData = labors.find(l => l.descripcion === labor);

            const record: Omit<AttendanceRecord, 'id' | 'lotName'> = {
                date: formattedDate,
                lote: loteMasterData.lote,
                variedad: loteMasterData.variedad,
                fechaCianamida: loteMasterData.fechaCianamida
 ? typeof loteMasterData.fechaCianamida === 'string'
 ? new Date(loteMasterData.fechaCianamida)
 : loteMasterData.fechaCianamida
 : undefined,
                campana: loteMasterData.campana,
                code: laborMasterData?.codigo,
                labor,
                assistants: groupAssistants,
                totals: groupTotals,
                registeredBy: auth.currentUser.email,
            };

            const docRef = doc(attendanceCollection);
            batch.set(docRef, record);
        }

        await batch.commit();
        
        toast({
            title: 'Éxito',
            description: 'Registros de asistencia guardados correctamente.',
        });
        form.reset({
          date: new Date(),
          lote: '',
          code: '',
          labor: '',
          assistants: [],
        });
        setAssistants([]);

    } catch (error) {
        console.error("Error guardando registros:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudieron guardar los registros de asistencia.',
        });
    }
  }

  const canAddAssistant = !!loteIdValue && !!laborValue;

  return (
    <div className="space-y-6">
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
                        <TableHead>Asistente/Encargado</TableHead>
                        <TableHead>Personas</TableHead>
                        <TableHead>Faltos</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assistants.map((assistant) => (
                        <TableRow key={assistant.id}>
                          <TableCell className="font-medium truncate">{assistant.assistantName}</TableCell>
                          <TableCell>{assistant.personnelCount}</TableCell>
                          <TableCell>{assistant.absentCount}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAssistant(assistant.id)}>
                              <Trash2 className="h-4 w-4" /><span className="sr-only">Eliminar</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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
            <Button type="submit" disabled={assistants.length === 0} className="w-full">
              <Save className="mr-2 h-4 w-4" />Guardar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddAssistantDialogOpen(true)}
              disabled={!canAddAssistant}
              title={!canAddAssistant ? 'Debes seleccionar un lote y una labor primero' : ''}
              className="w-full"
            >
              <PlusCircle className="mr-2 h-4 w-4" />Agregar Asistente
            </Button>
          </div>
        </form>
      </Form>
      <AddAssistantDialog
        isOpen={isAddAssistantDialogOpen}
        setIsOpen={setIsAddAssistantDialogOpen}
        onAddAssistant={handleAddAssistant}
        selectedDate={form.getValues('date')}
        loteName={selectedLoteData?.lote}
        labor={laborValue}
        currentAssistants={assistants}
        isSpecialLabor={codeValue === '902'}
        currentUserName={userProfile?.nombre || auth.currentUser?.email || ''}
      />
    </div>
  );
}
