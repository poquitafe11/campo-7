"use client";

import { useState, useMemo, useEffect } from 'react';
import { useMasterData } from '@/context/MasterDataContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

interface AssistantSelectorProps {
  label: string;
  value: string; // The ID of the selected assistant
  onSelect: (assistant: { id: string; name: string }) => void;
  disabled?: boolean;
}

export function AssistantSelector({ label, value, onSelect, disabled }: AssistantSelectorProps) {
  const { asistentes, refreshData, loading } = useMasterData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const selectedAssistantName = useMemo(() => {
    return asistentes.find(a => a.id === value)?.assistantName || "";
  }, [value, asistentes]);

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const filteredAssistants = useMemo(() => {
    if (!search) {
      return asistentes;
    }
    return asistentes.filter(a =>
      a.assistantName.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, asistentes]);
  
  const canCreateNew = search.trim().length > 0 && !filteredAssistants.some(a => a.assistantName.toLowerCase() === search.trim().toLowerCase());

  const handleCreate = async () => {
    if (!canCreateNew || isCreating) return;
    setIsCreating(true);
    const newName = search.trim();
    
    try {
      const docRef = doc(collection(db, "asistentes"));
      await setDoc(docRef, { nombre: newName, cargo: "Indefinido" });
      toast({ title: "Éxito", description: `Asistente "${newName}" creado.` });
      await refreshData();
      onSelect({ id: docRef.id, name: newName });
      setOpen(false);
    } catch (error) {
      console.error("Error creating assistant:", error);
      toast({ title: "Error", description: "No se pudo crear el asistente.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || loading}
        >
          {value ? selectedAssistantName : `Seleccionar ${label}...`}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2">
            <Input
                placeholder={`Buscar ${label}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
            />
        </div>
        <ScrollArea className="h-[200px]">
            {filteredAssistants.map((assistant) => (
            <div
                key={assistant.id}
                onClick={() => {
                  onSelect({ id: assistant.id, name: assistant.assistantName });
                  setOpen(false);
                }}
                className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer text-sm"
            >
                {assistant.assistantName}
                <Check
                className={cn(
                    "ml-2 h-4 w-4",
                    value === assistant.id ? "opacity-100" : "opacity-0"
                )}
                />
            </div>
            ))}
            {canCreateNew && (
                <div onClick={handleCreate} className="p-2 text-sm text-primary hover:bg-primary/10 cursor-pointer flex items-center gap-2">
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="h-4 w-4"/>}
                    Crear "{search.trim()}"
                </div>
            )}
            {search && filteredAssistants.length === 0 && !canCreateNew && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No se encontraron resultados.
              </div>
            )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
