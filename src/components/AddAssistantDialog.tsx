
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMasterData } from '@/context/MasterDataContext';
import { PlusCircle, Trash2, Loader2, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { type Assistant, type Jalador, type JaladorAttendance } from '@/lib/types';
import { addJalador } from '@/app/maestro-jaladores/actions';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';

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

  const [selectedAssistantDni, setSelectedAssistantDni] = useState<string>('');
  const [jaladoresList, setJaladoresList] = useState<JaladorAttendance[]>([]);
  
  const [selectedJalador, setSelectedJalador] = useState<Jalador | null>(null);
  const [jaladorSearch, setJaladorSearch] = useState('');
  const [showJaladorResults, setShowJaladorResults] = useState(false);
  
  const [personnelCount, setPersonnelCount] = useState<number | string>(0);
  const [absentCount, setAbsentCount] = useState<number | string>(0);
  const [isCreatingJalador, setIsCreatingJalador] = useState(false);


  const availableJaladores = useMemo(() => {
    return jaladoresMaster.filter(j => !jaladoresList.some(jl => jl.jaladorId === j.id));
  }, [jaladoresMaster, jaladoresList]);

  const filteredJaladores = useMemo(() => {
    if (!jaladorSearch) return [];
    return availableJaladores.filter(j => 
        j.alias.toLowerCase().includes(jaladorSearch.toLowerCase())
    );
  }, [jaladorSearch, availableJaladores]);

  const canCreateNewJalador = jaladorSearch.trim().length > 0 && !filteredJaladores.some(j => j.alias.toLowerCase() === jaladorSearch.toLowerCase().trim());

  const handleSelectJalador = (jalador: Jalador) => {
    setSelectedJalador(jalador);
    setJaladorSearch(jalador.alias);
    setShowJaladorResults(false);
  };
  
  const handleCreateJalador = async () => {
      if (!canCreateNewJalador || isCreatingJalador) return;
      setIsCreatingJalador(true);
      
      const newAlias = jaladorSearch.trim();
      const result = await addJalador({ alias: newAlias });
      
      if(result.success && result.id) {
          toast({ title: 'Éxito', description: `Jalador "${newAlias}" creado.` });
          await refreshData(); // Refresh master data to include the new jalador
          const newJalador: Jalador = { id: result.id, alias: newAlias, dni: '', celular: '', nombre: '' };
          handleSelectJalador(newJalador);
      } else {
          toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
      setIsCreatingJalador(false);
  }

  const handleAddJaladorToList = () => {
    if (!selectedJalador) {
      toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un jalador.' });
      return;
    }
    const numPersonnel = Number(personnelCount);
    const numAbsent = Number(absentCount);

    if (isNaN(numPersonnel) || numPersonnel < 0 || isNaN(numAbsent) || numAbsent < 0) {
      toast({ variant: 'destructive', title: 'Error de validación', description: 'Las cantidades deben ser números válidos y no negativos.' });
      return;
    }
     if (numPersonnel < numAbsent) {
      toast({ variant: 'destructive', title: 'Error de validación', description: 'El número de faltos no puede ser mayor al de personal.' });
      return;
    }

    const newJaladorAttendance: JaladorAttendance = {
      id: crypto.randomUUID(),
      jaladorId: selectedJalador.id,
      jaladorAlias: selectedJalador.alias,
      personnelCount: numPersonnel,
      absentCount: numAbsent,
    };

    setJaladoresList(prev => [...prev, newJaladorAttendance]);

    // Reset inputs
    setSelectedJalador(null);
    setJaladorSearch('');
    setPersonnelCount(0);
    setAbsentCount(0);
  };

  const handleRemoveJalador = (id: string) => {
    setJaladoresList(prev => prev.filter(j => j.id !== id));
  };

  const handleConfirm = () => {
    if (!selectedAssistantDni) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Debe seleccionar un asistente.' });
      return;
    }
     if (jaladoresList.length === 0) {
      toast({ variant: 'destructive', title: 'Lista Vacía', description: 'Debe agregar al menos un jalador con su personal.' });
      return;
    }

    const selectedAssistant = assistantsMaster.find(a => a.id === selectedAssistantDni);
    if (!selectedAssistant) return;

    const totalPersonnel = jaladoresList.reduce((sum, j) => sum + j.personnelCount, 0);
    const totalAbsent = jaladoresList.reduce((sum, j) => sum + j.absentCount, 0);

    onAddAssistant({
      assistantDni: selectedAssistant.id,
      assistantName: selectedAssistant.assistantName,
      jaladores: jaladoresList,
      personnelCount: totalPersonnel,
      absentCount: totalAbsent,
    });

    handleClose();
  };

  const handleClose = () => {
    setSelectedAssistantDni('');
    setJaladoresList([]);
    setSelectedJalador(null);
    setJaladorSearch('');
    setPersonnelCount(0);
    setAbsentCount(0);
    setShowJaladorResults(false);
    setIsOpen(false);
  };

  const availableAssistants = useMemo(() => {
    return assistantsMaster.filter(a => !currentAssistantsDnis.includes(a.id));
  }, [assistantsMaster, currentAssistantsDnis]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
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
              <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-end gap-2">
                <div className="relative space-y-1">
                  <Label htmlFor="jalador-search" className="text-xs">Jalador</Label>
                   <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                      <Input
                        id="jalador-search"
                        placeholder="Buscar o crear..."
                        value={jaladorSearch}
                        onChange={(e) => {
                          setJaladorSearch(e.target.value);
                          setShowJaladorResults(true);
                          setSelectedJalador(null);
                        }}
                        onFocus={() => setShowJaladorResults(true)}
                        onBlur={() => setTimeout(() => setShowJaladorResults(false), 150)}
                        className="pl-8"
                      />
                   </div>
                  {showJaladorResults && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg">
                      <ScrollArea className="max-h-48">
                        {filteredJaladores.map(j => (
                          <div key={j.id} onMouseDown={() => handleSelectJalador(j)} className="p-2 hover:bg-muted cursor-pointer text-sm">
                            {j.alias}
                          </div>
                        ))}
                        {canCreateNewJalador && (
                           <div onMouseDown={handleCreateJalador} className="p-2 text-sm text-primary hover:bg-primary/10 cursor-pointer flex items-center gap-2">
                             {isCreatingJalador ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4"/>}
                             Crear "{jaladorSearch}"
                           </div>
                        )}
                        {jaladorSearch && filteredJaladores.length === 0 && !canCreateNewJalador && (
                            <div className="p-2 text-sm text-muted-foreground">No hay resultados.</div>
                        )}
                      </ScrollArea>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor='personnel-count' className="text-xs">Personal</Label>
                  <Input id='personnel-count' type="number" min="0" value={personnelCount} onChange={(e) => setPersonnelCount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor='absent-count' className="text-xs">Faltos</Label>
                  <Input id='absent-count' type="number" min="0" value={absentCount} onChange={(e) => setAbsentCount(e.target.value)} />
                </div>
                <Button type="button" size="icon" onClick={handleAddJaladorToList}>
                  <PlusCircle className="h-4 w-4" />
                </Button>
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
                          <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveJalador(j.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
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
           <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={handleClose}>Cancelar</Button>
           <Button type="button" className="w-full sm:w-auto" onClick={handleConfirm} disabled={!selectedAssistantDni || jaladoresList.length === 0}>
            Confirmar y Agregar a Lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

