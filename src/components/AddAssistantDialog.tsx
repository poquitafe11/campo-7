"use client";

import { useState, useEffect } from 'react';
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
import type { Assistant } from '@/lib/types';
import { useMasterData } from '@/context/MasterDataContext';


type AssistantMaster = {
    dni: string;
    nombre: string;
    cargo: string;
}

const addAssistantSchema = z.object({
  assistantDni: z.string().min(1, 'Debe seleccionar un asistente.'),
  personnelCount: z.coerce.number().int().min(0, 'El número no puede ser negativo.'),
  absentCount: z.coerce.number().int().min(0, 'El número no puede ser negativo.'),
}).refine(data => data.personnelCount >= data.absentCount, {
    message: "El número de faltos no puede ser mayor al número de personas.",
    path: ["absentCount"],
});

type AddAssistantFormValues = z.infer<typeof addAssistantSchema>;

interface AddAssistantDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAddAssistant: (assistant: Omit<Assistant, 'id'>) => void;
  selectedDate?: Date;
  loteName?: string;
  labor?: string;
  currentAssistants: (Assistant & { loteId: string; loteName: string; labor: string })[];
  isSpecialLabor: boolean;
  currentUserName: string;
}

export default function AddAssistantDialog({
  isOpen,
  setIsOpen,
  onAddAssistant,
  loteName,
  labor,
  currentAssistants,
  isSpecialLabor,
  currentUserName,
}: AddAssistantDialogProps) {
  
  const { asistentes: assistantsMaster, loading } = useMasterData();

  const form = useForm<AddAssistantFormValues>({
    resolver: zodResolver(addAssistantSchema),
    defaultValues: {
      assistantDni: '',
      personnelCount: 0,
      absentCount: 0,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        assistantDni: isSpecialLabor ? 'special' : '',
        personnelCount: isSpecialLabor ? 1 : 0,
        absentCount: 0,
      });
    }
  }, [isOpen, form, isSpecialLabor]);

  const onSubmit = (data: AddAssistantFormValues) => {
    const selectedAssistant = assistantsMaster.find(a => a.id === data.assistantDni);
    
    let assistantName = 'N/A';
    let assistantDni = 'N/A';
    if (isSpecialLabor) {
        assistantName = currentUserName;
        assistantDni = 'special'; // Special DNI for this case
    } else if (selectedAssistant) {
        assistantName = selectedAssistant.assistantName;
        assistantDni = selectedAssistant.id;
    }

    if (!isSpecialLabor && currentAssistants.some(a => a.assistantDni === assistantDni && a.loteName === loteName && a.labor === labor)) {
        form.setError('assistantDni', {
            type: 'manual',
            message: 'Este asistente ya ha sido añadido para este lote y labor.',
        });
        return;
    }
    
    onAddAssistant({
      assistantName,
      assistantDni,
      personnelCount: data.personnelCount,
      absentCount: data.absentCount,
    });
    setIsOpen(false);
  };
  

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Asistente a la Lista</DialogTitle>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField
                    control={form.control}
                    name="assistantDni"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Asistente/Encargado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSpecialLabor || loading}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder={loading ? "Cargando..." : "Seleccione un asistente"} />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {isSpecialLabor ? (
                                <SelectItem value="special" disabled>{currentUserName}</SelectItem>
                            ) : (
                                assistantsMaster.map((assistant) => (
                                    <SelectItem key={assistant.id} value={assistant.id}>
                                        {assistant.assistantName}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="personnelCount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nº de Personas</FormLabel>
                        <FormControl>
                            <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="absentCount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nº de Faltos</FormLabel>
                        <FormControl>
                            <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        Cancelar
                    </Button>
                    </DialogClose>
                    <Button type="submit">Agregar</Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
