
"use client";

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMasterData } from '@/context/MasterDataContext';
import { PlusCircle, Loader2, Search } from 'lucide-react';
import { addAsistente } from '@/app/asistentes/actions';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';

interface AddAssistantOnlyDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSuccess: () => void;
}

export default function AddAssistantOnlyDialog({
  isOpen,
  setIsOpen,
  onSuccess,
}: AddAssistantOnlyDialogProps) {
  const { asistentes: assistantsMaster, loading, refreshData } = useMasterData();
  const { toast } = useToast();
  
  const [assistantSearch, setAssistantSearch] = useState('');
  const [showAssistantResults, setShowAssistantResults] = useState(false);
  const [isCreatingAssistant, setIsCreatingAssistant] = useState(false);
  
  const filteredAssistants = useMemo(() => {
    if (!assistantSearch) return assistantsMaster;
    return assistantsMaster.filter(a => 
      a.assistantName.toLowerCase().includes(assistantSearch.toLowerCase()) ||
      a.id.toLowerCase().includes(assistantSearch.toLowerCase())
    );
  }, [assistantSearch, assistantsMaster]);

  const canCreateNewAssistant = assistantSearch.trim().length > 0 && !assistantsMaster.some(a => a.assistantName.toLowerCase() === assistantSearch.toLowerCase().trim());
  
  const handleCreateAssistant = async () => {
    if (!canCreateNewAssistant || isCreatingAssistant) return;
    setIsCreatingAssistant(true);
    const newName = assistantSearch.trim();

    const result = await addAsistente({ nombre: newName, cargo: "Generico" });

    if (result.success && result.id) {
      toast({ title: 'Éxito', description: `Asistente "${newName}" creado.`});
      await refreshData();
      onSuccess();
      setIsOpen(false);
      resetState();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive'});
    }
    setIsCreatingAssistant(false);
  }
  
  const resetState = () => {
    setAssistantSearch('');
    setShowAssistantResults(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) resetState();
        setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Asistente al Maestro</DialogTitle>
          <DialogDescription>
            Busca un asistente existente o crea uno nuevo para agregarlo a la base de datos principal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Buscar Asistente/Encargado</Label>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <Input
                        placeholder="Buscar por nombre o DNI..."
                        value={assistantSearch}
                        onChange={e => {
                            setAssistantSearch(e.target.value);
                            setShowAssistantResults(true);
                        }}
                        onFocus={() => setShowAssistantResults(true)}
                        onBlur={() => setTimeout(() => setShowAssistantResults(false), 200)}
                        className="pl-8"
                        disabled={loading}
                    />
                    {showAssistantResults && (
                        <div className="absolute z-20 w-full mt-1 bg-background border rounded-md shadow-lg">
                        <ScrollArea className="max-h-48">
                            {filteredAssistants.length > 0 && filteredAssistants.map(a => (
                            <div key={a.id} onMouseDown={() => {
                                setAssistantSearch(a.assistantName);
                                setShowAssistantResults(false);
                            }} className="p-2 hover:bg-muted cursor-pointer text-sm">
                                {a.assistantName} <span className="text-muted-foreground">({a.id})</span>
                            </div>
                            ))}
                            {canCreateNewAssistant && (
                            <div onMouseDown={handleCreateAssistant} className="p-2 text-sm text-primary hover:bg-primary/10 cursor-pointer flex items-center gap-2">
                                {isCreatingAssistant ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4"/>}
                                Crear nuevo asistente: "{assistantSearch.trim()}"
                            </div>
                            )}
                            {assistantSearch && filteredAssistants.length === 0 && !canCreateNewAssistant && (
                            <div className="p-2 text-sm text-muted-foreground">No se encontraron asistentes.</div>
                            )}
                        </ScrollArea>
                        </div>
                    )}
                </div>
            </div>
        </div>
         <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
