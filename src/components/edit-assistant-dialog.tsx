
"use client";

import { useEffect } from 'react';
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
import type { AttendanceRecord, Assistant } from '@/lib/types';

const editAssistantSchema = z.object({
  assistantName: z.string(), // Non-editable, just for display
  personnelCount: z.coerce.number().int().min(0, 'El número no puede ser negativo.'),
  absentCount: z.coerce.number().int().min(0, 'El número no puede ser negativo.'),
}).refine(data => data.personnelCount >= data.absentCount, {
    message: "El número de faltos no puede ser mayor al número de personas.",
    path: ["absentCount"],
});

type EditAssistantFormValues = z.infer<typeof editAssistantSchema>;

interface EditAssistantDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  editingData: { record: AttendanceRecord; assistant: Assistant } | null;
  onSave: (recordId: string, assistantId: string, updatedData: Omit<Assistant, 'id'>) => void;
}

export default function EditAssistantDialog({ isOpen, setIsOpen, editingData, onSave }: EditAssistantDialogProps) {
  const form = useForm<EditAssistantFormValues>({
    resolver: zodResolver(editAssistantSchema),
    defaultValues: {
      assistantName: '',
      personnelCount: 0,
      absentCount: 0,
    },
  });

  useEffect(() => {
    if (editingData) {
      form.reset({
        assistantName: editingData.assistant.assistantName,
        personnelCount: editingData.assistant.personnelCount,
        absentCount: editingData.assistant.absentCount,
      });
    }
  }, [editingData, form]);

  const onSubmit = (data: EditAssistantFormValues) => {
    if (editingData) {
      onSave(editingData.record.id, editingData.assistant.id, {
        assistantName: editingData.assistant.assistantName, // Name is not editable
        personnelCount: data.personnelCount,
        absentCount: data.absentCount,
      });
    }
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Registro de Asistente</DialogTitle>
          <DialogDescription>
            Ajusta el número de personal y faltos para este registro.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                 <FormField
                    control={form.control}
                    name="assistantName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Asistente</FormLabel>
                        <FormControl>
                            <Input {...field} readOnly disabled />
                        </FormControl>
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
                <DialogFooter className="pt-4">
                    <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        Cancelar
                    </Button>
                    </DialogClose>
                    <Button type="submit">Guardar Cambios</Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
