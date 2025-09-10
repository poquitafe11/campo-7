"use client";

import { useState, useEffect, useMemo } from 'react';
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
  const { toast } = useToast();

  // State for the main dialog
  const [selectedAssistantDni, setSelectedAssistantDni] = useState<string>('');
  const [jaladoresList, setJaladoresList] = useState<JaladorAttendance[]>([]);
  
  // Local state for the "add jalador" sub-form
  const [selectedJalador, setSelectedJalador] = useState<Jalador | null>(null);
  const [personnelCount, setPersonnelCount] = useState<number>(0);
  const [absentCount, setAbsentCount] = useState<number>(0);

  const availableJaladores = useMemo(() => {
    return jaladoresMaster.filter(j => !jaladoresList.some(jl => jl.jaladorId === j.id));
  }, [jaladoresMaster, jaladoresList]);

  const handleAddJaladorToList = () => {
    // Manual validation
    if (!selectedJalador) {
        toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un jalador.' });
        return;
    }
    if (personnelCount < absentCount) {
        toast({ variant: 'destructive', title: 'Error de validación', description: 'El número de faltos no puede ser mayor al de personal.' });
        return;
    }

    const newJaladorAttendance: JaladorAttendance = {
      id: crypto.randomUUID(),
      jaladorId: selectedJalador.id,
      jaladorAlias: selectedJalador.alias,
      personnelCount: personnelCount,
      absentCount: absentCount,
    };
    
    setJaladoresList(prev => [...prev, newJaladorAttendance]);
    
    // Reset sub-form fields
    setSelectedJalador(null);
    setPersonnelCount(0);
    setAbsentCount(0);
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

    const totalPersonnel = jaladoresList.reduce((sum, j) => sum + j.personnelCount, 0);
    const totalAbsent = jaladoresList.reduce((sum, j) => sum + j.absentCount, 0);

    onAddAssistant({
      assistantDni: selectedAssistant.id,
      assistantName: selectedAssistant.assistantName,
      personnelCount: totalPersonnel,
      absentCount: totalAbsent,
      jaladores: jaladoresList,
    });
    
    handleClose();
  };

  const handleClose = () => {
    setSelectedAssistantDni('');
    setJaladoresList([]);
    setSelectedJalador(null);
    setPersonnelCount(0);
    setAbsentCount(0);
    setIsOpen(false);
  }

  const availableAssistants = useMemo(() => {
    return assistantsMaster.filter(a => !currentAssistantsDnis.includes(a.id));
  }, [assistantsMaster, currentAssistantsDnis]);
  
  const handleCreateJalador = async (alias: string): Promise<Jalador | null> => {
    if (!alias.trim()) return null;
    const result = await addJalador({ alias: alias.trim() });
    if(result.success && result.id) {
        toast({ title: 'Éxito', description: `Jalador "${alias}" creado.` });
        await refreshData(); // Refresh master data to include the new jalador
        const newJalador = { id: result.id, alias: alias.trim() };
        return newJalador;
    } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
        return null;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar Asistente y su Personal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Paso 1: Seleccionar Asistente/Encargado</Label>
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
              <Label>Paso 2: Agregar Jaladores y Personal</Label>
              
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-start gap-2">
                  <div className="space-y-1">
                      <Label className="text-xs">Jalador</Label>
                      <JaladorCombobox
                          jaladores={availableJaladores}
                          value={selectedJalador}
                          onSelect={setSelectedJalador}
                          onCreate={handleCreateJalador}
                          disabled={loading}
                      />
                  </div>
                  <div className="space-y-1">
                      <Label className="text-xs">Personal</Label>
                      <Input type="number" value={personnelCount} onChange={(e) => setPersonnelCount(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                      <Label className="text-xs">Faltos</Label>
                      <Input type="number" value={absentCount} onChange={(e) => setAbsentCount(Number(e.target.value))} />
                  </div>

                  <div className="self-end">
                    <Button type="button" size="icon" onClick={handleAddJaladorToList}>
                        <PlusCircle className="h-4 w-4"/>
                    </Button>
                  </div>
                </div>
                 
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
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="w-full sm:w-auto" onClick={handleConfirm} disabled={!selectedAssistantDni || jaladoresList.length === 0}>
              Confirmar y Agregar a Lista
            </Button>
            <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={handleClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function JaladorCombobox({
  jaladores,
  value,
  onSelect,
  onCreate,
  disabled
}: {
  jaladores: Jalador[];
  value: Jalador | null;
  onSelect: (jalador: Jalador | null) => void;
  onCreate: (alias: string) => Promise<Jalador | null>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (search.trim() && !isCreating) {
        setIsCreating(true);
        const newJalador = await onCreate(search.trim());
        if (newJalador) {
            onSelect(newJalador);
        }
        setSearch('');
        setOpen(false);
        setIsCreating(false);
    }
  };

  const filteredJaladores = useMemo(() => {
    if (!search) return jaladores;
    return jaladores.filter(j => j.alias.toLowerCase().includes(search.toLowerCase()));
  }, [search, jaladores]);
  
  const showCreateOption = search && !filteredJaladores.some(j => j.alias.toLowerCase() === search.toLowerCase());

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
          {value ? value.alias : "Seleccionar"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar o crear jalador..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
                No se encontró el jalador.
            </CommandEmpty>
            <CommandGroup>
              {filteredJaladores.map(jalador => (
                <CommandItem
                  key={jalador.id}
                  value={jalador.alias}
                  onSelect={() => {
                    onSelect(jalador);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value?.id === jalador.id ? "opacity-100" : "opacity-0")} />
                  {jalador.alias}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreateOption && (
                <CommandItem
                  onSelect={handleCreate}
                  className="text-primary hover:!bg-primary/10 cursor-pointer"
                >
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Crear nuevo jalador: "{search}"
                </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
