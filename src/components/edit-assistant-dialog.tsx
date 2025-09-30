"use client";

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import type { AttendanceRecord, Assistant, JaladorAttendance } from '@/lib/types';
import { Label } from './ui/label';


const jaladorAttendanceSchema = z.object({
  id: z.string(),
  jaladorAlias: z.string(),
  personnelCount: z.coerce.number().int().min(0, 'Debe ser un número no negativo.'),
  absentCount: z.coerce.number().int().min(0, 'Debe ser un número no negativo.'),
}).refine(data => data.personnelCount >= data.absentCount, {
    message: "Faltos no puede ser mayor que personal.",
    path: ["absentCount"],
});

const editAssistantSchema = z.object({
  assistantName: z.string(), // Non-editable, just for display
  jaladores: z.array(jaladorAttendanceSchema),
});

type EditAssistantFormValues = z.infer<typeof editAssistantSchema>;

interface EditAssistantDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  editingData: { record: AttendanceRecord; assistant: Assistant } | null;
  onSave: (recordId: string, assistantId: string, updatedJaladores: JaladorAttendance[]) => void;
}

export default function EditAssistantDialog({ isOpen, setIsOpen, editingData, onSave }: EditAssistantDialogProps) {
  const form = useForm<EditAssistantFormValues>({
    resolver: zodResolver(editAssistantSchema),
    defaultValues: {
      assistantName: '',
      jaladores: [],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "jaladores",
  });

  useEffect(() => {
    if (editingData?.assistant) {
      // THE FIX: Ensure `jaladores` is always an array before passing it to the form.
      const jaladores = editingData.assistant.jaladores || [];
      form.reset({
        assistantName: editingData.assistant.assistantName,
        jaladores: jaladores,
      });
    }
  }, [editingData, form]);

  const onSubmit = (data: EditAssistantFormValues) => {
    if (editingData) {
      onSave(editingData.record.id, editingData.assistant.id, data.jaladores);
    }
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Registro de Asistente</DialogTitle>
          <DialogDescription>
            Ajusta el personal y los faltos por cada jalador.
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

                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                    {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-3 gap-2 items-center p-2 rounded-md bg-muted/50">
                            <Label className="col-span-3 text-sm font-medium">{field.jaladorAlias}</Label>
                            <FormField
                                control={form.control}
                                name={`jaladores.${index}.personnelCount`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Personal</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage className="text-xs"/>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`jaladores.${index}.absentCount`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Faltos</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage className="text-xs"/>
                                    </FormItem>
                                )}
                            />
                        </div>
                    ))}
                </div>
                
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
