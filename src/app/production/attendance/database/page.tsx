
"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Trash2, Pencil, Users, Sprout, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteAttendanceRecord } from './actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useRouter } from 'next/navigation';
import type { AttendanceRecord, Assistant } from '@/lib/types';
import EditAssistantDialog from '@/components/edit-assistant-dialog';

type AttendanceRecordWithId = AttendanceRecord & { id: string };

interface GroupedRecord {
  lote: string;
  labor: string;
  assistants: Assistant[];
  totals: {
    personnelCount: number;
    absentCount: number;
  };
  originalRecordId: string;
}

export default function AttendanceDatabasePage() {
  const [records, setRecords] = useState<AttendanceRecordWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { setActions } = useHeaderActions();
  const router = useRouter();
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingData, setEditingData] = useState<{ record: AttendanceRecordWithId; assistant: Assistant } | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "asistencia"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AttendanceRecordWithId));
      setRecords(recordsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching attendance records: ", error);
      toast({
        title: "Error de Conexión",
        description: "No se pudieron cargar los registros de asistencia.",
        variant: "destructive"
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);
  
  useEffect(() => {
    setActions({
      title: "Historial de Asistencia",
    });
    return () => setActions({});
  }, [setActions, router]);

  const groupedByDate = useMemo(() => {
    return records.reduce((acc, record) => {
      const dateKey = record.date;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(record);
      return acc;
    }, {} as Record<string, AttendanceRecordWithId[]>);
  }, [records]);
  
  const handleEditAssistant = (record: AttendanceRecordWithId, assistant: Assistant) => {
    setEditingData({ record, assistant });
    setIsEditDialogOpen(true);
  };
  
  const handleSaveAssistantUpdate = async (recordId: string, assistantId: string, updatedData: Omit<Assistant, 'id'>) => {
    startTransition(async () => {
        const recordRef = doc(db, 'asistencia', recordId);
        const recordToUpdate = records.find(r => r.id === recordId);
        
        if (!recordToUpdate) {
            toast({ variant: "destructive", title: "Error", description: "No se encontró el registro original." });
            return;
        }

        const updatedAssistants = recordToUpdate.assistants.map(a => 
            a.id === assistantId ? { ...a, ...updatedData } : a
        );
        
        const newTotals = updatedAssistants.reduce((acc, a) => {
            acc.personnelCount += a.personnelCount;
            acc.absentCount += a.absentCount;
            return acc;
        }, { personnelCount: 0, absentCount: 0 });

        try {
            await updateDoc(recordRef, { 
                assistants: updatedAssistants,
                totals: newTotals
            });
            toast({ title: "Éxito", description: "Registro de asistente actualizado." });
        } catch (error) {
            console.error("Error updating assistant:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el registro." });
        }
    });
  };

  const handleDeleteRecord = (id: string) => {
    startTransition(async () => {
      const result = await deleteAttendanceRecord(id);
      if (result.success) {
        toast({ title: "Éxito", description: "Registro de asistencia eliminado." });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  if (loading) {
     return <div className="flex h-64 items-center justify-center"><Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col h-full space-y-4">
        {Object.keys(groupedByDate).length > 0 ? (
            <Accordion type="single" collapsible className="w-full space-y-4">
                {Object.entries(groupedByDate).map(([date, dateRecords]) => (
                    <AccordionItem value={date} key={date} className="border rounded-lg">
                        <AccordionTrigger className="px-4 py-3 text-lg font-semibold hover:no-underline">
                            {format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-0 space-y-3">
                           {dateRecords.map(record => (
                               <div key={record.id} className="border rounded-md p-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className='flex items-center gap-4 text-sm'>
                                      <span className='flex items-center gap-1'><Sprout size={16} /> <strong>Lote:</strong> {record.lote}</span>
                                      <span className='flex items-center gap-1'><Wrench size={16} /> <strong>Labor:</strong> {record.labor}</span>
                                    </div>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/>Eliminar Registro</Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>¿Eliminar todo el registro?</AlertDialogTitle>
                                            <AlertDialogDescription>Esta acción eliminará el registro completo para este lote y labor del día. No se puede deshacer.</AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteRecord(record.id)}>Eliminar</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                  </div>
                                   <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Asistente/Encargado</TableHead>
                                        <TableHead>Personal</TableHead>
                                        <TableHead>Faltos</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {record.assistants.map(assistant => (
                                        <TableRow key={assistant.id}>
                                          <TableCell>{assistant.assistantName}</TableCell>
                                          <TableCell>{assistant.personnelCount}</TableCell>
                                          <TableCell>{assistant.absentCount}</TableCell>
                                          <TableCell className="text-right">
                                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditAssistant(record, assistant)}>
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                               </div>
                           ))}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                <p className="text-center text-muted-foreground">No se encontraron registros de asistencia.</p>
            </div>
        )}
        <EditAssistantDialog 
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          editingData={editingData}
          onSave={handleSaveAssistantUpdate}
        />
    </div>
  );
}

