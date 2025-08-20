
"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Trash2, Pencil, Users, Sprout, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteAttendanceRecord, deleteAssistantFromRecord } from './actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useRouter } from 'next/navigation';
import type { AttendanceRecord, Assistant } from '@/lib/types';
import EditAssistantDialog from '@/components/edit-assistant-dialog';
import { useMasterData } from '@/context/MasterDataContext';

type AttendanceRecordWithId = AttendanceRecord & { id: string };

export default function AttendanceDatabasePage() {
  const [records, setRecords] = useState<AttendanceRecordWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { setActions } = useHeaderActions();
  const router = useRouter();
  const { lotes: masterLotes, loading: masterLoading } = useMasterData();
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingData, setEditingData] = useState<{ record: AttendanceRecordWithId; assistant: Assistant } | null>(null);

  const lotesMap = useMemo(() => {
    const map = new Map<string, string>();
    masterLotes.forEach(lote => {
        map.set(lote.id, lote.lote);
    });
    return map;
  }, [masterLotes]);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "asistencia"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => {
        const data = doc.data();
        let date;
        if (data.date?.toDate) {
            date = data.date.toDate();
        } else if (typeof data.date === 'string' && isValid(parseISO(data.date))) {
            date = parseISO(data.date);
        } else {
            date = new Date();
        }
        return { id: doc.id, ...data, date } as AttendanceRecordWithId;
      });
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
      left: (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
        </Button>
      ),
      center: "Historial de Asistencia",
    });
    return () => setActions({});
  }, [setActions, router]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, { records: AttendanceRecordWithId[], totalPersonnel: number, totalAbsent: number }> = {};
    for (const record of records) {
        if (!record.date || !isValid(record.date)) continue;
        
        // --- FIX: Standardize the date key ---
        const dateKey = format(startOfDay(record.date), 'yyyy-MM-dd');
        
        if (!groups[dateKey]) {
            groups[dateKey] = { records: [], totalPersonnel: 0, totalAbsent: 0 };
        }
        groups[dateKey].records.push(record);
        groups[dateKey].totalPersonnel += record.totals.personnelCount;
        groups[dateKey].totalAbsent += record.totals.absentCount;
    }
    return groups;
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

  const handleDeleteAssistant = async (recordId: string, assistantId: string) => {
     startTransition(async () => {
      const result = await deleteAssistantFromRecord(recordId, assistantId);
      if (result.success) {
        toast({ title: "Éxito", description: "Asistente eliminado del registro." });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };

  const getLoteName = (record: AttendanceRecordWithId) => {
    if (record.lotName) return record.lotName;
    return lotesMap.get(record.lote) || record.lote;
  };

  if (loading || masterLoading) {
     return <div className="flex h-64 items-center justify-center"><Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col h-full space-y-4">
        {Object.keys(groupedByDate).length > 0 ? (
            <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={Object.keys(groupedByDate)[0]}>
                {Object.entries(groupedByDate).map(([dateKey, { records: dateRecords, totalPersonnel, totalAbsent }]) => (
                    <AccordionItem value={dateKey} key={dateKey} className="border-none">
                       <AccordionTrigger className="p-4 bg-background rounded-lg shadow-sm border hover:no-underline">
                           <div className="flex justify-between items-center w-full">
                               <span className="text-lg font-semibold text-gray-800">
                                   {format(parseISO(dateKey), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                               </span>
                               <div className="flex gap-4 text-sm font-medium">
                                   <span>Total Personal: <span className="font-bold text-primary">{totalPersonnel}</span></span>
                                   <span>Total Faltos: <span className="font-bold text-destructive">{totalAbsent}</span></span>
                               </div>
                           </div>
                       </AccordionTrigger>
                        <AccordionContent className="pt-3 space-y-3">
                           {dateRecords.map(record => (
                               <div key={record.id} className="border rounded-lg p-4 bg-background/50 space-y-3">
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                                    <div className='flex flex-col gap-1'>
                                      <div className='flex items-center gap-2 text-sm'><Sprout size={16} className="text-primary"/> <strong>Lote:</strong> {getLoteName(record) || 'N/A'}</div>
                                      <div className='flex items-center gap-2 text-sm'><Wrench size={16} className="text-primary"/> <strong>Labor:</strong> {record.labor}</div>
                                    </div>
                                  </div>
                                   
                                   <div className="overflow-x-auto">
                                      <Table className="text-xs">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Asistente/Encargado</TableHead>
                                            <TableHead className="text-center">Personal</TableHead>
                                            <TableHead className="text-center">Faltos</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {record.assistants.map(assistant => (
                                            <TableRow key={assistant.id}>
                                              <TableCell className="font-medium whitespace-pre-wrap">{assistant.assistantName}</TableCell>
                                              <TableCell className="text-center">{assistant.personnelCount}</TableCell>
                                              <TableCell className="text-center">{assistant.absentCount}</TableCell>
                                              <TableCell className="text-right">
                                                  <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditAssistant(record, assistant)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Eliminar asistente?</AlertDialogTitle>
                                                            <AlertDialogDescription>Se eliminará a {assistant.assistantName} de este registro.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteAssistant(record.id, assistant.id)}>Eliminar</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                  </div>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                   </div>
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

    