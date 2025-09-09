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
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMasterData } from '@/context/MasterDataContext';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Assistant, JaladorAttendance } from '@/lib/types';


const addJaladorSchema = z.object({
  jaladorId: z.string().min(1, "Debe seleccionar un jalador."),
  personnelCount: z.coerce.number().int().min(0, 'El número no puede ser negativo.'),
  absentCount: z.coerce.number().int().min(0, 'El número no puede ser negativo.'),
}).refine(data => data.personnelCount >= data.absentCount, {
    message: "El número de faltos no puede ser mayor al número de personas.",
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
  
  const { asistentes: assistantsMaster, jaladores: jaladoresMaster, loading } = useMasterData();
  const [selectedAssistantDni, setSelectedAssistantDni] = useState<string>('');
  const [jaladoresList, setJaladoresList] = useState<JaladorAttendance[]>([]);

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
    jaladorForm.reset();
  };

  const handleRemoveJalador = (id: string) => {
    setJaladoresList(prev => prev.filter(j => j.id !== id));
  };
  
  const handleConfirm = () => {
    if (!selectedAssistantDni || jaladoresList.length === 0) return;
    
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
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar Asistente y su Personal</DialogTitle>
        </DialogHeader>

        <Form {...jaladorForm}>
          <div className="space-y-4 py-4">
              <FormItem>
                  <FormLabel>Paso 1: Seleccionar Asistente/Encargado</FormLabel>
                  <Select onValueChange={setSelectedAssistantDni} value={selectedAssistantDni} disabled={loading}>
                  <FormControl>
                      <SelectTrigger>
                      <SelectValue placeholder={loading ? "Cargando..." : "Seleccione un asistente"} />
                      </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                      {availableAssistants.map((assistant) => (
                          <SelectItem key={assistant.id} value={assistant.id}>
                              {assistant.assistantName}
                          </SelectItem>
                      ))}
                  </SelectContent>
                  </Select>
              </FormItem>

              {selectedAssistantDni && (
                  <div className="space-y-4 pt-4 border-t">
                      <h4 className="font-medium">Paso 2: Agregar Jaladores y Personal</h4>
                      <form onSubmit={jaladorForm.handleSubmit(handleAddJalador)} className="flex items-end gap-2">
                        <FormField control={jaladorForm.control} name="jaladorId" render={({ field }) => (
                            <FormItem className="flex-1"><FormLabel>Jalador</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger>
                                <SelectValue placeholder="Seleccionar"/>
                              </SelectTrigger></FormControl><SelectContent>{availableJaladores.map(j => <SelectItem key={j.id} value={j.id}>{j.alias}</SelectItem>)}</SelectContent></Select>
                            <FormMessage /></FormItem>
                        )}/>
                          <FormField control={jaladorForm.control} name="personnelCount" render={({ field }) => (<FormItem><FormLabel>Personal</FormLabel><FormControl><Input type="number" {...field} className="w-20"/></FormControl></FormItem>)}/>
                          <FormField control={jaladorForm.control} name="absentCount" render={({ field }) => (<FormItem><FormLabel>Faltos</FormLabel><FormControl><Input type="number" {...field} className="w-20"/></FormControl></FormItem>)}/>
                          <Button type="submit" size="icon"><PlusCircle className="h-4 w-4"/></Button>
                      </form>
                      
                       {jaladoresList.length > 0 && (
                          <div className="border rounded-md max-h-48 overflow-y-auto">
                              <Table>
                                  <TableHeader><TableRow><TableHead>Jalador</TableHead><TableHead>Personal</TableHead><TableHead>Faltos</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                  <TableBody>
                                      {jaladoresList.map(j => (
                                          <TableRow key={j.id}>
                                              <TableCell>{j.jaladorAlias}</TableCell>
                                              <TableCell>{j.personnelCount}</TableCell>
                                              <TableCell>{j.absentCount}</TableCell>
                                              <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveJalador(j.id)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                              </Table>
                          </div>
                      )}
                  </div>
              )}
          </div>
        </Form>
        <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="button" onClick={handleConfirm} disabled={jaladoresList.length === 0}>
              Confirmar y Agregar a Lista
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
