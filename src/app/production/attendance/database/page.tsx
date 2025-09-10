
"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Trash2, Pencil, Users, Sprout, Wrench, Briefcase, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteAttendanceRecord, deleteAssistantFromRecord } from './actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useRouter } from 'next/navigation';
import type { AttendanceRecord, Assistant, JaladorAttendance } from '@/lib/types';
import EditAssistantDialog from '@/components/edit-assistant-dialog';
import { useMasterData } from '@/context/MasterDataContext';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


type AttendanceRecordWithId = AttendanceRecord & { id: string };

interface JaladorGroup {
    [jaladorAlias: string]: JaladorAttendance[];
}
interface AssistantGroup {
    id: string;
    assistantName: string;
    jaladores: JaladorGroup;
    totalPersonnel: number;
    totalAbsent: number;
}
interface LoteGroup {
  [loteName: string]: {
      recordId: string;
      assistants: AssistantGroup[];
  }
}
interface LaborGroup {
  [labor: string]: LoteGroup;
}
interface DayGroup {
  [dateKey: string]: LaborGroup;
}


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

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "asistencia"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => {
        const data = doc.data();
        let date: Date;
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
      title: "Historial de Asistencia"
    });
    return () => setActions({});
  }, [setActions, router]);

  const groupedByDate = useMemo(() => {
    const groups: DayGroup = {};

    for (const record of records) {
        if (!record.date || !isValid(record.date)) continue;
        
        const dateKey = format(startOfDay(record.date), 'yyyy-MM-dd');
        const laborKey = record.labor || 'Sin Labor';
        const loteKey = record.lotName || record.lote || 'Sin Lote';

        if (!groups[dateKey]) groups[dateKey] = {};
        if (!groups[dateKey][laborKey]) groups[dateKey][laborKey] = {};
        if (!groups[dateKey][laborKey][loteKey]) {
            groups[dateKey][laborKey][loteKey] = {
                recordId: record.id,
                assistants: [],
            };
        }

        const loteGroup = groups[dateKey][laborKey][loteKey];
        record.assistants.forEach(assistant => {
            let existingAssistant = loteGroup.assistants.find(a => a.assistantName === assistant.assistantName);
            if (!existingAssistant) {
                existingAssistant = {
                    id: assistant.id,
                    assistantName: assistant.assistantName,
                    jaladores: {},
                    totalPersonnel: 0,
                    totalAbsent: 0,
                };
                loteGroup.assistants.push(existingAssistant);
            }
            
            assistant.jaladores.forEach(jalador => {
                if(!existingAssistant!.jaladores[jalador.jaladorAlias]) {
                    existingAssistant!.jaladores[jalador.jaladorAlias] = [];
                }
                existingAssistant!.jaladores[jalador.jaladorAlias].push(jalador);
            });

            const assistantTotals = assistant.jaladores.reduce((acc, j) => {
              acc.personnelCount += j.personnelCount;
              acc.absentCount += j.absentCount;
              return acc;
            }, { personnelCount: 0, absentCount: 0 });

            existingAssistant.totalPersonnel += assistantTotals.personnelCount;
            existingAssistant.totalAbsent += assistantTotals.absentCount;
        });
    }
    return groups;
  }, [records]);
  
  const handleEditAssistant = (recordId: string, assistant: Assistant) => {
    const record = records.find(r => r.id === recordId);
    if(record) {
      setEditingData({ record, assistant });
      setIsEditDialogOpen(true);
    }
  };
  
  const handleSaveAssistantUpdate = async (recordId: string, assistantId: string, updatedData: Omit<Assistant, 'id' | 'assistantDni'>) => {
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
            const jaladorTotals = a.jaladores.reduce((jAcc, j) => {
              jAcc.personnelCount += j.personnelCount;
              jAcc.absentCount += j.absentCount;
              return jAcc;
            }, { personnelCount: 0, absentCount: 0 });

            acc.personnelCount += jaladorTotals.personnelCount;
            acc.absentCount += jaladorTotals.absentCount;
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

  const handleDeleteAssistant = async (recordId: string, assistantId: string) => {
     startTransition(async () => {
      const result = await deleteAssistantFromRecord(recordId, assistantId);
      if (result.success) {
        toast({ title: "Éxito", description: result.message });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    });
  };
  
  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));
  }, [groupedByDate]);

  if (loading || masterLoading) {
     return <div className="flex h-64 items-center justify-center"><Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col h-full space-y-4">
        {sortedDateKeys.length > 0 ? (
            <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={sortedDateKeys[0]}>
                {sortedDateKeys.map((dateKey) => {
                    const laborsForDay = groupedByDate[dateKey];
                    const dailyTotalPersonnel = Object.values(laborsForDay).flatMap(lotes => Object.values(lotes).flatMap(l => l.assistants)).reduce((sum, assistant) => sum + assistant.totalPersonnel, 0);
                    const dailyTotalAbsent = Object.values(laborsForDay).flatMap(lotes => Object.values(lotes).flatMap(l => l.assistants)).reduce((sum, assistant) => sum + assistant.totalAbsent, 0);

                    return (
                        <AccordionItem value={dateKey} key={dateKey} className="border rounded-lg shadow-sm bg-background">
                           <AccordionTrigger className="p-4 hover:no-underline">
                               <div className="flex justify-between items-center w-full">
                                   <span className="text-md sm:text-lg font-semibold text-gray-800">
                                       {format(parseISO(dateKey), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                                   </span>
                                   <div className="flex gap-4 text-sm font-medium">
                                       <span>Total Personal: <span className="font-bold text-primary">{dailyTotalPersonnel}</span></span>
                                       <span>Total Faltos: <span className="font-bold text-destructive">{dailyTotalAbsent}</span></span>
                                   </div>
                               </div>
                           </AccordionTrigger>
                            <AccordionContent className="pt-0 px-4 pb-4 space-y-2">
                                <Accordion type="multiple" className="w-full space-y-2">
                                    {Object.entries(laborsForDay).map(([labor, lotes]) => {
                                        const laborTotalPersonnel = Object.values(lotes).flatMap(l => l.assistants).reduce((sum, assistant) => sum + assistant.totalPersonnel, 0);
                                        const laborTotalAbsent = Object.values(lotes).flatMap(l => l.assistants).reduce((sum, assistant) => sum + assistant.totalAbsent, 0);
                                        return (
                                            <AccordionItem value={labor} key={labor} className="border-none">
                                                <AccordionTrigger className="p-3 bg-muted/50 rounded-md hover:no-underline">
                                                     <div className="flex justify-between items-center w-full">
                                                        <div className="flex items-center gap-2 text-sm sm:text-base font-medium"><Wrench size={16} />{labor}</div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary">Personal: {laborTotalPersonnel}</Badge>
                                                            <Badge variant="destructive" className="bg-red-100 text-red-800">Faltos: {laborTotalAbsent}</Badge>
                                                        </div>
                                                     </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pt-2 pl-2 pr-0 pb-0 space-y-2">
                                                     {Object.entries(lotes).map(([loteName, loteData]) => {
                                                        const loteTotalPersonnel = loteData.assistants.reduce((sum, a) => sum + a.totalPersonnel, 0);
                                                        const loteTotalAbsent = loteData.assistants.reduce((sum, a) => sum + a.totalAbsent, 0);
                                                        return (
                                                        <Collapsible key={loteName} className="border-l-2 border-primary/50 pl-3">
                                                            <CollapsibleTrigger className="flex justify-between items-center w-full p-2 text-left hover:bg-muted/30 rounded-md">
                                                                <div className="flex items-center gap-2 text-sm font-medium"><Sprout size={16} />Lote: {loteName}</div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline">Personal: {loteTotalPersonnel}</Badge>
                                                                    <Badge variant="destructive" className="bg-red-100 text-red-800">Faltos: {loteTotalAbsent}</Badge>
                                                                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                                                                </div>
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent className="p-2">
                                                                <div className="overflow-x-auto border rounded-md">
                                                                     <Table className="text-xs bg-white">
                                                                        <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead className="w-[50%]">Asistente/Encargado</TableHead>
                                                                            <TableHead className="text-center">Personal</TableHead>
                                                                            <TableHead className="text-center">Faltos</TableHead>
                                                                            <TableHead className="text-right">Acciones</TableHead>
                                                                        </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                        {loteData.assistants.map(assistant => (
                                                                            <Collapsible asChild key={assistant.id}>
                                                                                <>
                                                                                    <TableRow>
                                                                                        <TableCell className="p-0" colSpan={4}>
                                                                                            <div className="flex items-center w-full">
                                                                                                <CollapsibleTrigger className="flex-1 text-left p-2.5 flex items-center gap-2">
                                                                                                    {assistant.assistantName}
                                                                                                    <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                                                                                                </CollapsibleTrigger>
                                                                                                <div className="w-16 text-center">{assistant.totalPersonnel}</div>
                                                                                                <div className="w-16 text-center">{assistant.totalAbsent}</div>
                                                                                                <div className="w-24 text-right pr-2">
                                                                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditAssistant(loteData.recordId, assistant)} disabled={isPending}>
                                                                                                        <Pencil className="h-4 w-4" />
                                                                                                    </Button>
                                                                                                    <AlertDialog>
                                                                                                        <AlertDialogTrigger asChild>
                                                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/80" disabled={isPending}>
                                                                                                                <Trash2 className="h-4 w-4" />
                                                                                                            </Button>
                                                                                                        </AlertDialogTrigger>
                                                                                                        <AlertDialogContent>
                                                                                                            <AlertDialogHeader>
                                                                                                                <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                                                                                                <AlertDialogDescription>Se eliminará al asistente <strong>{assistant.assistantName}</strong> y todo su personal de este registro. Esta acción es permanente.</AlertDialogDescription>
                                                                                                            </AlertDialogHeader>
                                                                                                            <AlertDialogFooter>
                                                                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                                                                <AlertDialogAction onClick={() => handleDeleteAssistant(loteData.recordId, assistant.id)}>Eliminar</AlertDialogAction>
                                                                                                            </AlertDialogFooter>
                                                                                                        </AlertDialogContent>
                                                                                                    </AlertDialog>
                                                                                                </div>
                                                                                            </div>
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                    <CollapsibleContent asChild>
                                                                                        <TableRow>
                                                                                            <TableCell colSpan={4} className="p-0 bg-slate-50">
                                                                                                <div className="p-2">
                                                                                                    <Table>
                                                                                                        <TableHeader>
                                                                                                            <TableRow>
                                                                                                                <TableHead className="h-7">Jalador</TableHead>
                                                                                                                <TableHead className="h-7 text-center">Personal</TableHead>
                                                                                                                <TableHead className="h-7 text-center">Faltos</TableHead>
                                                                                                            </TableRow>
                                                                                                        </TableHeader>
                                                                                                        <TableBody>
                                                                                                            {Object.entries(assistant.jaladores).map(([jaladorAlias, jaladorRecords]) => {
                                                                                                                const totalP = jaladorRecords.reduce((s, j) => s + j.personnelCount, 0);
                                                                                                                const totalA = jaladorRecords.reduce((s, j) => s + j.absentCount, 0);
                                                                                                                return (
                                                                                                                    <TableRow key={jaladorAlias}>
                                                                                                                        <TableCell>{jaladorAlias}</TableCell>
                                                                                                                        <TableCell className="text-center">{totalP}</TableCell>
                                                                                                                        <TableCell className="text-center">{totalA}</TableCell>
                                                                                                                    </TableRow>
                                                                                                                )
                                                                                                            })}
                                                                                                        </TableBody>
                                                                                                    </Table>
                                                                                                </div>
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    </CollapsibleContent>
                                                                                </>
                                                                            </Collapsible>
                                                                        ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                     )})}
                                                </AccordionContent>
                                            </AccordionItem>
                                        )
                                    })}
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
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
