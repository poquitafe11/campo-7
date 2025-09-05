
"use client";

import { useEffect, useMemo, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ActivityRecordData, ActivityRecordSchema, LoteData } from '@/lib/types';
import { useMasterData } from '@/context/MasterDataContext';
import { updateActivity } from '@/app/production/activities/database/actions';
import { CalendarIcon, Grape, Boxes, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';


const EditActivityFormSchema = ActivityRecordSchema.partial().extend({
  registerDate: z.date({required_error: "La fecha es requerida."}),
});

type EditActivityFormValues = z.infer<typeof EditActivityFormSchema>;

interface EditActivityDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activity: (ActivityRecordData & { id: string }) | null;
  onSuccess: () => void;
}

export default function EditActivityDialog({ isOpen, onOpenChange, activity, onSuccess }: EditActivityDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { labors, lotes, loading: masterLoading } = useMasterData();

  const form = useForm<EditActivityFormValues>({
    resolver: zodResolver(EditActivityFormSchema),
  });

  const uniqueLotes = useMemo(() => {
    const lotesMap = new Map<string, LoteData>();
    lotes.forEach(lote => {
      if (!lotesMap.has(lote.lote)) {
        lotesMap.set(lote.lote, lote);
      }
    });
    return Array.from(lotesMap.values());
  }, [lotes]);
  
  const codeValue = useWatch({ control: form.control, name: 'code' });
  
  useEffect(() => {
    if (codeValue) {
      const matchedLabor = labors.find(l => l.codigo === codeValue);
      form.setValue('labor', matchedLabor?.descripcion || '', { shouldValidate: true });
    } else {
      form.setValue('labor', '', { shouldValidate: true });
    }
  }, [codeValue, labors, form]);

  useEffect(() => {
    if (activity && isOpen) {
        let registerDate;
        if (activity.registerDate instanceof Date) {
            registerDate = activity.registerDate;
        } else if (typeof activity.registerDate === 'string') {
            registerDate = parseISO(activity.registerDate);
        } else {
             // Fallback for Firestore Timestamp
            registerDate = (activity.registerDate as any).toDate ? (activity.registerDate as any).toDate() : new Date();
        }

      form.reset({
        ...activity,
        registerDate,
      });
    }
  }, [activity, isOpen, form]);

  const onSubmit = (data: EditActivityFormValues) => {
    if (!activity) return;

    startTransition(async () => {
        const result = await updateActivity(activity.id, data);
        if (result.success) {
            toast({
                title: 'Éxito',
                description: 'Actividad actualizada correctamente.',
            });
            onSuccess();
        } else {
            toast({
                variant: 'destructive',
                title: 'Error al Actualizar',
                description: result.message || 'No se pudo actualizar la actividad.',
            });
        }
    });
  };

  const showExtraPerformanceField = useMemo(() => ['46', '67'].includes(codeValue || ''), [codeValue]);
  const performanceLabel = showExtraPerformanceField ? "Rendimiento (Plantas)" : "Rendimiento";
  const extraPerformanceLabel = codeValue === '46' ? "Rendimiento (Racimos)" : "Rendimiento (Jabas)";
  const ExtraPerformanceIcon = codeValue === '46' ? Grape : Boxes;


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar Ficha de Actividad</DialogTitle>
          <DialogDescription>
            Modifica los detalles del registro de actividad.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
            
            <FormField
              control={form.control}
              name="registerDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Registro</FormLabel>
                   <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es} />
                      </PopoverContent>
                    </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <FormField control={form.control} name="campaign" render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaña</FormLabel>
                  <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2025">2025</SelectItem>
                            <SelectItem value="2026">2026</SelectItem>
                            <SelectItem value="2027">2027</SelectItem>
                          </SelectContent>
                      </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Etapa</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="habilitacion">Habilitacion</SelectItem>
                          <SelectItem value="formacion">Formacion</SelectItem>
                          <SelectItem value="produccion">Produccion</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lote" render={({ field }) => (
                 <FormItem>
                   <FormLabel>Lote</FormLabel>
                   <FormControl>
                     <Select onValueChange={field.onChange} value={field.value}>
                         <SelectTrigger>
                           <SelectValue placeholder={masterLoading ? "Cargando..." : "Selecciona"} />
                         </SelectTrigger>
                       <SelectContent>
                         {uniqueLotes.map(lote => <SelectItem key={lote.id} value={lote.lote}>{lote.lote}</SelectItem>)}
                       </SelectContent>
                     </Select>
                   </FormControl>
                   <FormMessage />
                 </FormItem>
               )} />
            </div>
            
            <div className="grid grid-cols-6 gap-4">
                <FormField control={form.control} name="code" render={({ field }) => ( <FormItem className="col-span-1"> <FormLabel>Cód.</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="labor" render={({ field }) => ( <FormItem className="col-span-5"> <FormLabel>Labor</FormLabel> <FormControl><Input {...field} readOnly /></FormControl> <FormMessage /> </FormItem> )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="performance" render={({ field }) => ( <FormItem> <FormLabel>{performanceLabel}</FormLabel> <FormControl><Input type="number" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                {showExtraPerformanceField && (
                    <FormField control={form.control} name="clustersOrJabas" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-2"><ExtraPerformanceIcon className="h-4 w-4" />{extraPerformanceLabel}</FormLabel> <FormControl><Input type="number" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                )}
                <FormField control={form.control} name="personnelCount" render={({ field }) => ( <FormItem> <FormLabel># Personas</FormLabel> <FormControl><Input type="number" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="workdayCount" render={({ field }) => ( <FormItem> <FormLabel># Jornadas</FormLabel> <FormControl><Input type="number" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="cost" render={({ field }) => ( <FormItem> <FormLabel>Costo (S/)</FormLabel> <FormControl><Input type="number" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                 <FormField control={form.control} name="shift" render={({ field }) => (
                   <FormItem>
                     <FormLabel>Turno</FormLabel>
                     <FormControl>
                       <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                         <SelectContent>
                           <SelectItem value="Mañana">Mañana</SelectItem>
                           <SelectItem value="Tarde">Tarde</SelectItem>
                         </SelectContent>
                       </Select>
                     </FormControl>
                     <FormMessage />
                   </FormItem>
                 )} />
                <FormField control={form.control} name="pass" render={({ field }) => ( <FormItem> <FormLabel>Pasada</FormLabel> <FormControl><Input type="number" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="minRange" render={({ field }) => ( <FormItem> <FormLabel>Min</FormLabel> <FormControl><Input type="number" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="maxRange" render={({ field }) => ( <FormItem> <FormLabel>Max</FormLabel> <FormControl><Input type="number" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            </div>
            
            <FormField control={form.control} name="observations" render={({ field }) => ( <FormItem> <FormLabel>Observaciones</FormLabel> <FormControl><Textarea {...field} /></FormControl> <FormMessage /> </FormItem> )} />


            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || masterLoading}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
