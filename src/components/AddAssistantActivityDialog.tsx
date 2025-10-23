
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMasterData } from '@/context/MasterDataContext';
import { PlusCircle, Loader2, Search } from 'lucide-react';
import { addAsistente } from '@/app/asistentes/actions';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { type GroupActivityRow } from '@/app/production/activities/create/page';
import { Textarea } from './ui/textarea';

const activityRowSchema = z.object({
  assistantDni: z.string().min(1, 'Debe seleccionar un asistente.'),
  assistantName: z.string(),
  performance: z.coerce.number().min(0, "Debe ser un número no negativo."),
  clustersOrJabas: z.coerce.number().optional(),
  personnelCount: z.coerce.number().int().min(1, 'Mínimo 1 persona.'),
  workdayCount: z.coerce.number().min(0, "Debe ser un número no negativo."),
  minRange: z.coerce.number(),
  maxRange: z.coerce.number(),
  observations: z.string().optional(),
});
type ActivityRowValues = z.infer<typeof activityRowSchema>;

interface AddAssistantActivityDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAddActivity: (activity: GroupActivityRow) => void;
  currentAssistantsDnis: string[];
  showExtraPerformanceField: boolean;
  performanceLabel: string;
  extraPerformanceLabel: string;
  ExtraPerformanceIcon: React.ElementType;
  existingActivity: GroupActivityRow | null;
}

export default function AddAssistantActivityDialog({
  isOpen,
  setIsOpen,
  onAddActivity,
  currentAssistantsDnis,
  showExtraPerformanceField,
  performanceLabel,
  extraPerformanceLabel,
  ExtraPerformanceIcon,
  existingActivity,
}: AddAssistantActivityDialogProps) {
  const { asistentes: assistantsMaster, loading, refreshData } = useMasterData();
  const { toast } = useToast();
  
  const [selectedAssistant, setSelectedAssistant] = useState<{ assistantDni: string; assistantName: string } | null>(null);
  const [assistantSearch, setAssistantSearch] = useState('');
  const [showAssistantResults, setShowAssistantResults] = useState(false);
  const [isCreatingAssistant, setIsCreatingAssistant] = useState(false);

  const form = useForm<ActivityRowValues>({
    resolver: zodResolver(activityRowSchema),
    defaultValues: {
      assistantDni: '',
      assistantName: '',
      performance: 0,
      clustersOrJabas: 0,
      personnelCount: 1,
      workdayCount: 0,
      minRange: 0,
      maxRange: 0,
      observations: '',
    },
  });
  
  useEffect(() => {
    if (existingActivity) {
      form.reset({
        ...existingActivity,
      });
      setSelectedAssistant({ assistantDni: existingActivity.assistantDni, assistantName: existingActivity.assistantName });
      setAssistantSearch(existingActivity.assistantName);
    } else {
      form.reset({
        assistantDni: '',
        assistantName: '',
        performance: 0,
        clustersOrJabas: 0,
        personnelCount: 1,
        workdayCount: 0,
        minRange: 0,
        maxRange: 0,
        observations: '',
      });
      setSelectedAssistant(null);
      setAssistantSearch('');
    }
  }, [existingActivity, isOpen, form]);

  const availableAssistants = useMemo(() => {
    return assistantsMaster.filter(a => !currentAssistantsDnis.includes(a.id) || (existingActivity && a.id === existingActivity.assistantDni));
  }, [assistantsMaster, currentAssistantsDnis, existingActivity]);
  
  const filteredAssistants = useMemo(() => {
    if (!assistantSearch) return [];
    return availableAssistants.filter(a => 
      a.assistantName.toLowerCase().includes(assistantSearch.toLowerCase()) ||
      a.id.toLowerCase().includes(assistantSearch.toLowerCase())
    );
  }, [assistantSearch, availableAssistants]);

  const canCreateNewAssistant = assistantSearch.trim().length > 0 && !filteredAssistants.some(a => a.assistantName.toLowerCase() === assistantSearch.toLowerCase().trim());
  
  const handleSelectAssistant = (assistant: { id: string; assistantName: string }) => {
    setSelectedAssistant({ assistantDni: assistant.id, assistantName: assistant.assistantName });
    setAssistantSearch(assistant.assistantName);
    form.setValue('assistantDni', assistant.id);
    form.setValue('assistantName', assistant.assistantName);
    setShowAssistantResults(false);
  };
  
  const handleCreateAssistant = async () => {
    if (!canCreateNewAssistant || isCreatingAssistant) return;
    setIsCreatingAssistant(true);
    const newName = assistantSearch.trim();

    const result = await addAsistente({ nombre: newName, dni: '', cargo: "Asistente" });

    if (result.success && result.id) {
      toast({ title: 'Éxito', description: `Asistente "${newName}" creado.`});
      await refreshData();
      handleSelectAssistant({ id: result.id, assistantName: newName });
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive'});
    }
    setIsCreatingAssistant(false);
  }
  
  const onSubmit = (data: ActivityRowValues) => {
    onAddActivity({
      ...data,
      id: existingActivity?.id || crypto.randomUUID(),
    });
    setIsOpen(false);
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{existingActivity ? 'Editar' : 'Agregar'} Actividad de Asistente</DialogTitle>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="space-y-2">
                    <Label>Asistente/Encargado</Label>
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                        <Input
                            placeholder="Buscar por nombre o DNI..."
                            value={assistantSearch}
                            onChange={e => {
                                setAssistantSearch(e.target.value);
                                setShowAssistantResults(true);
                                setSelectedAssistant(null);
                                form.setValue('assistantDni', '');
                                form.setValue('assistantName', '');
                            }}
                            onFocus={() => setShowAssistantResults(true)}
                            onBlur={() => setTimeout(() => setShowAssistantResults(false), 150)}
                            className="pl-8"
                            disabled={loading || !!existingActivity}
                        />
                         {form.formState.errors.assistantDni && <p className="text-sm font-medium text-destructive">{form.formState.errors.assistantDni.message}</p>}
                        {showAssistantResults && (
                            <div className="absolute z-20 w-full mt-1 bg-background border rounded-md shadow-lg">
                            <ScrollArea className="max-h-48">
                                {filteredAssistants.map(a => (
                                <div key={a.id} onMouseDown={() => handleSelectAssistant(a)} className="p-2 hover:bg-muted cursor-pointer text-sm">
                                    {a.assistantName} <span className="text-muted-foreground">({a.id})</span>
                                </div>
                                ))}
                                {canCreateNewAssistant && (
                                <div onMouseDown={handleCreateAssistant} className="p-2 text-sm text-primary hover:bg-primary/10 cursor-pointer flex items-center gap-2">
                                    {isCreatingAssistant ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4"/>}
                                    Crear "{assistantSearch.trim()}"
                                </div>
                                )}
                                {assistantSearch && filteredAssistants.length === 0 && !canCreateNewAssistant && (
                                <div className="p-2 text-sm text-muted-foreground">No hay resultados.</div>
                                )}
                            </ScrollArea>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="performance" render={({ field }) => (
                        <FormItem><FormLabel>{performanceLabel}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     {showExtraPerformanceField && (
                        <FormField control={form.control} name="clustersOrJabas" render={({ field }) => (
                            <FormItem><FormLabel>{extraPerformanceLabel}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                     )}
                     <FormField control={form.control} name="personnelCount" render={({ field }) => (
                        <FormItem><FormLabel># Personas</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={form.control} name="workdayCount" render={({ field }) => (
                        <FormItem><FormLabel># Jornadas (JHU)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={form.control} name="minRange" render={({ field }) => (
                        <FormItem><FormLabel>Mínimo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={form.control} name="maxRange" render={({ field }) => (
                        <FormItem><FormLabel>Máximo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                 <FormField control={form.control} name="observations" render={({ field }) => (
                    <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                )}/>

                <DialogFooter className="pt-4">
                    <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button type="submit">{existingActivity ? 'Actualizar Fila' : 'Agregar a la Lista'}</Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

