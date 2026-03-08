"use client";

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMasterData } from '@/context/MasterDataContext';
import { PlusCircle, Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

interface AddAssistantActivityDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSelectAssistant: (assistant: { assistantDni: string, assistantName: string }) => void;
  currentAssistantsDnis: string[];
}

export default function AddAssistantActivityDialog({
  isOpen,
  setIsOpen,
  onSelectAssistant,
  currentAssistantsDnis,
}: AddAssistantActivityDialogProps) {
  const { asistentes: assistantsMaster, loading, refreshData } = useMasterData();
  const { toast } = useToast();
  
  const [assistantSearch, setAssistantSearch] = useState('');
  const [showAssistantResults, setShowAssistantResults] = useState(false);
  const [isCreatingAssistant, setIsCreatingAssistant] = useState(false);
  
  const availableAssistants = useMemo(() => {
    return assistantsMaster.filter(a => !currentAssistantsDnis.includes(a.id));
  }, [assistantsMaster, currentAssistantsDnis]);
  
  const filteredAssistants = useMemo(() => {
    if (!assistantSearch) return [];
    return availableAssistants.filter(a => 
      a.assistantName.toLowerCase().includes(assistantSearch.toLowerCase()) ||
      a.id.toLowerCase().includes(assistantSearch.toLowerCase())
    );
  }, [assistantSearch, availableAssistants]);

  const canCreateNewAssistant = assistantSearch.trim().length > 0 && !filteredAssistants.some(a => a.assistantName.toLowerCase() === assistantSearch.toLowerCase().trim());
  
  const handleSelectAssistant = (assistant: { id: string; assistantName: string }) => {
    onSelectAssistant({ assistantDni: assistant.id, assistantName: assistant.assistantName });
    setIsOpen(false);
    resetState();
  };
  
  const handleCreateAssistant = async () => {
    if (!canCreateNewAssistant || isCreatingAssistant) return;
    setIsCreatingAssistant(true);
    const newName = assistantSearch.trim();

    try {
      const docRef = doc(collection(db, "asistentes"));
      await setDoc(docRef, { nombre: newName, cargo: "Asistente" });
      toast({ title: 'Éxito', description: `Asistente "${newName}" creado.`});
      await refreshData();
      onSelectAssistant({ assistantDni: docRef.id, assistantName: newName });
      setIsOpen(false);
      resetState();
    } catch (error) {
      console.error("Error creating assistant:", error);
      toast({ title: 'Error', description: "No se pudo crear el asistente.", variant: 'destructive'});
    } finally {
      setIsCreatingAssistant(false);
    }
  }
  
  const resetState = () => {
    setAssistantSearch('');
    setShowAssistantResults(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seleccionar Asistente</DialogTitle>
          <DialogDescription>
            Busca un asistente por nombre o DNI para agregarlo a la ficha de labor grupal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="search-assistant-input">Buscar Asistente/Encargado</Label>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <Input
                        id="search-assistant-input"
                        name="search-assistant-input"
                        placeholder="Buscar por nombre o DNI..."
                        value={assistantSearch}
                        onChange={e => {
                            setAssistantSearch(e.target.value);
                            setShowAssistantResults(true);
                        }}
                        onFocus={() => setShowAssistantResults(true)}
                        onBlur={() => setTimeout(() => setShowAssistantResults(false), 150)}
                        className="pl-8"
                        disabled={loading}
                    />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
