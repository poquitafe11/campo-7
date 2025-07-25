
"use client";

import { useEffect, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { ActivityRecordData, LoteData } from '@/lib/types';
import { useMasterData } from '@/context/MasterDataContext';
import { updateActivity } from '@/app/production/activities/database/actions';
import { Loader2 } from 'lucide-react';


const EditActivityFormSchema = z.object({
  campaign: z.string().min(1, "La campaña es requerida."),
  stage: z.string().min(1, "La etapa es requerida."),
  lote: z.string().min(1, "El lote es requerido."),
  code: z.string().optional(),
  labor: z.string().optional(),
  performance: z.coerce.number(),
  personnelCount: z.coerce.number().int().min(1, "Debe haber al menos una persona."),
  workdayCount: z.coerce.number(),
  cost: z.coerce.number(),
  shift: z.string().min(1, "El turno es requerido."),
  minRange: z.coerce.number(),
  maxRange: z.coerce.number(),
  pass: z.coerce.number(),
  observations: z.string().optional(),
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
  
  const codeValue = form.watch('code');
  
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
      form.reset({
        campaign: activity.campaign,
        stage: activity.stage,
        lote: activity.lote,
        code: activity.code,
        labor: activity.labor,
        performance: activity.performance,
        personnelCount: activity.personnelCount,
        workdayCount: activity.workdayCount,
        cost: activity.cost,
        shift: activity.shift,
        minRange: activity.minRange,
        maxRange: activity.maxRange,
        pass: activity.pass,
        observations: activity.observations,
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar Ficha de Actividad</DialogTitle>
          <DialogDescription>
            Modifica los detalles del registro de actividad. La fecha y el usuario creador no se pueden cambiar.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
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
                <FormField control={form.control} name="performance" render={({ field }) => ( <FormItem> <FormLabel>Rendimiento</FormLabel> <FormControl><Input type="number" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
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
