"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMasterData } from '@/context/MasterDataContext';
import { PlusCircle, Trash2, ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Assistant, Jalador, JaladorAttendance } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { addJalador } from '@/app/maestro-jaladores/actions';
import { useToast } from '@/hooks/use-toast';


const addJaladorSchema = z.object({
  jaladorId: z.string().min(1, "Debe seleccionar un jalador."),
  personnelCount: z.coerce.number().int().min(0, 'El número no puede ser negativo.'),
  absentCount: z.coerce.number().int().min(0, 'El número no puede ser negativo.'),
}).refine(data => data.personnelCount >= data.absentCount, {
    message: "Faltos no puede ser mayor que personal.",
    path: ["absentCount"],
});
type AddJaladorFormValues = z.infer<typeof addJaladorSchema>;

interface AddAssistantDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAddAssistant: (assistant: Omit<Assistant, 'id'>) => void;
  currentAssistantsDnis: string[];
}

export default function AddAssistantDialog({
  isOpen,
  setIsOpen,
  onAddAssistant,
  currentAssistantsDnis,
}: AddAssistantDialogProps) {
  
  const { asistentes: assistantsMaster, jaladores: jaladoresMaster, loading, refreshData } = useMasterData();
  const [selectedAssistantDni, setSelectedAssistantDni] = useState<string>('');
  const [jaladoresList, setJaladoresList] = useState<JaladorAttendance[]>([]);
  const { toast } = useToast();
  const [isCreatingJalador, setIsCreatingJalador] = useState(false);

  const jaladorForm = useForm<AddJaladorFormValues>({
    resolver: zodResolver(addJaladorSchema),
    defaultValues: { jaladorId: '', personnelCount: 0, absentCount: 0 },
  });

  const availableJaladores = useMemo(() => {
    return jaladoresMaster.filter(j => !jaladoresList.some(jl => jl.jaladorId === j.id));
  }, [jaladoresMaster, jaladoresList]);

  const handleAddJalador = (data: AddJaladorFormValues) => {
    const selectedJalador = jaladoresMaster.find(j => j.id === data.jaladorId);
    if (!selectedJalador) return;

    const newJaladorAttendance: JaladorAttendance = {
      id: crypto.randomUUID(),
      jaladorId: selectedJalador.id,
      jaladorAlias: selectedJalador.alias,
      personnelCount: data.personnelCount,
      absentCount: data.absentCount,
    };
    setJaladoresList(prev => [...prev, newJaladorAttendance]);
    jaladorForm.reset({ jaladorId: '', personnelCount: 0, absentCount: 0 });
  };

  const handleRemoveJalador = (id: string) => {
    setJaladoresList(prev => prev.filter(j => j.id !== id));
  };
  
  const handleConfirm = () => {
    if (!selectedAssistantDni || jaladoresList.length === 0) {
        toast({
            variant: 'destructive',
            title: 'Faltan datos',
            description: 'Debe seleccionar un asistente y agregar al menos un jalador con su personal.'
        });
        return;
    }
    
    const selectedAssistant = assistantsMaster.find(a => a.id === selectedAssistantDni);
    if (!selectedAssistant) return;

    onAddAssistant({
      assistantDni: selectedAssistant.id,
      assistantName: selectedAssistant.assistantName,
      jaladores: jaladoresList,
    });
    
    handleClose();
  };

  const handleClose = () => {
    setSelectedAssistantDni('');
    setJaladoresList([]);
    jaladorForm.reset();
    setIsOpen(false);
  }

  const availableAssistants = useMemo(() => {
    return assistantsMaster.filter(a => !currentAssistantsDnis.includes(a.id));
  }, [assistantsMaster, currentAssistantsDnis]);
  
  const handleCreateJalador = async (alias: string) => {
    setIsCreatingJalador(true);
    const result = await addJalador({ alias });
    if(result.success) {
        toast({ title: 'Éxito', description: `Jalador "${alias}" creado.` });
        await refreshData();
        if (result.id) {
            jaladorForm.setValue('jaladorId', result.id);
        }
    } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
    setIsCreatingJalador(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar Asistente y su Personal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <p className="text-sm font-medium">Paso 1: Seleccionar Asistente/Encargado</p>
                <Select onValueChange={setSelectedAssistantDni} value={selectedAssistantDni} disabled={loading}>
                <SelectTrigger>
                    <SelectValue placeholder={loading ? "Cargando..." : "Seleccione un asistente"} />
                </SelectTrigger>
                <SelectContent>
                    {availableAssistants.map((assistant) => (
                        <SelectItem key={assistant.id} value={assistant.id}>
                            {assistant.assistantName}
                        </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>

            {selectedAssistantDni && (
                <div className="space-y-4 pt-4 border-t">
                    <p className="text-sm font-medium">Paso 2: Agregar Jaladores y Personal</p>
                    
                    <Form {...jaladorForm}>
                      <form onSubmit={jaladorForm.handleSubmit(handleAddJalador)}>
                        <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-end gap-2">
                          <FormField
                              control={jaladorForm.control}
                              name="jaladorId"
                              render={({ field }) => (
                              <FormItem>
                                  <Label>Jalador</Label>
                                  <JaladorCombobox
                                      jaladores={availableJaladores}
                                      value={field.value}
                                      onChange={field.onChange}
                                      onCreate={handleCreateJalador}
                                      disabled={loading || isCreatingJalador}
                                  />
                                  <FormMessage />
                              </FormItem>
                              )}
                          />
                          <FormField control={jaladorForm.control} name="personnelCount" render={({ field }) => (<FormItem><Label>Personal</Label><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                          <FormField control={jaladorForm.control} name="absentCount" render={({ field }) => (<FormItem><Label>Faltos</Label><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                          <Button type="submit" size="icon"><PlusCircle className="h-4 w-4"/></Button>
                        </div>
                      </form>
                    </Form>
                     
                     {jaladoresList.length > 0 && (
                        <div className="border rounded-md max-h-40 overflow-y-auto">
                            <Table>
                                <TableHeader><TableRow><TableHead>Jalador</TableHead><TableHead>Personal</TableHead><TableHead>Faltos</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {jaladoresList.map(j => (
                                        <TableRow key={j.id}>
                                            <TableCell>{j.jaladorAlias}</TableCell>
                                            <TableCell>{j.personnelCount}</TableCell>
                                            <TableCell>{j.absentCount}</TableCell>
                                            <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveJalador(j.id)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            )}
        </div>
        <DialogFooter className="flex flex-col gap-2">
            <Button type="button" className="w-full" onClick={handleConfirm} disabled={!selectedAssistantDni || jaladoresList.length === 0}>
              Confirmar y Agregar a Lista
            </Button>
            <Button type="button" className="w-full" variant="outline" onClick={handleClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function JaladorCombobox({
  jaladores,
  value,
  onChange,
  onCreate,
  disabled
}: {
  jaladores: Jalador[];
  value: string;
  onChange: (value: string) => void;
  onCreate: (alias: string) => Promise<void>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selectedAlias = useMemo(() => {
    return jaladores.find(j => j.id === value)?.alias || '';
  }, [value, jaladores]);
  
  const handleCreate = async () => {
    if (search.trim()) {
        setIsCreating(true);
        await onCreate(search.trim());
        setSearch('');
        setOpen(false);
        setIsCreating(false);
    }
  };

  const filteredJaladores = search
    ? jaladores.filter(j => j.alias.toLowerCase().includes(search.toLowerCase()))
    : jaladores;
  
  const showCreateOption = search && !jaladores.some(j => j.alias.toLowerCase() === search.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value ? selectedAlias : "Seleccionar"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar o crear jalador..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No se encontró el jalador.</CommandEmpty>
            <CommandGroup>
              {filteredJaladores.map(jalador => (
                <CommandItem
                  key={jalador.id}
                  value={jalador.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === jalador.id ? "opacity-100" : "opacity-0")} />
                  {jalador.alias}
                </CommandItem>
              ))}
              {showCreateOption && (
                 <CommandItem
                    onSelect={handleCreate}
                    className="text-primary hover:!bg-primary/10 cursor-pointer"
                 >
                    {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                     Crear nuevo jalador: "{search}"
                 </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}