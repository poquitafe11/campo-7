"use client";

import { useState, useMemo, useEffect } from 'react';
import { useMasterData } from '@/context/MasterDataContext';
import { useToast } from '@/hooks/use-toast';
import { addAsistente } from '@/app/asistentes/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Assistant } from '@/lib/types';

interface AssistantSelectorProps {
  label: string;
  value: string; // The ID of the selected assistant
  onSelect: (assistant: { id: string; name: string }) => void;
  disabled?: boolean;
}

export function AssistantSelector({ label, value, onSelect, disabled }: AssistantSelectorProps) {
  const { asistentes, refreshData } = useMasterData();
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
      a.id.includes(search)
    );
  }, [search, asistentes]);
  
  const canCreateNew = search.trim().length > 0 && !filteredAssistants.some(a => a.assistantName.toLowerCase() === search.trim().toLowerCase());

  const handleCreate = async () => {
    if (!canCreateNew || isCreating) return;
    setIsCreating(true);
    const newName = search.trim();
    
    const result = await addAsistente({ nombre: newName, cargo: "Indefinido" });
    if (result.success && result.id) {
      toast({ title: "Éxito", description: `Asistente "${newName}" creado.` });
      await refreshData();
      onSelect({ id: result.id, name: newName });
      setOpen(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsCreating(false);
  };

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
          {value ? selectedAssistantName : `Seleccionar ${label}...`}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
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
                    "mr-2 h-4 w-4",
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
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
