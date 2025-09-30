
"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Trash2, Pencil, Users, Sprout, Wrench, Briefcase, ChevronDown, Filter, Calendar as CalendarIcon, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteAssistantFromRecord } from './actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useRouter } from 'next/navigation';
import type { AttendanceRecord, Assistant, JaladorAttendance, User } from '@/lib/types';
import EditAssistantDialog from '@/components/edit-assistant-dialog';
import { useMasterData } from '@/context/MasterDataContext';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import * as xlsx from "xlsx";
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type AttendanceRecordWithId = AttendanceRecord & { id: string };

interface Filters {
    campaign: string;
    lote: string;
    labor: string;
    dateRange?: DateRange;
}

interface JaladorGroup {
    [jaladorAlias: string]: JaladorAttendance[];
}
interface AssistantGroup {
    id: string;
    assistantName: string;
    assistantDni: string;
    jaladores: JaladorGroup;
    totalPersonnel: number;
    totalAbsent: number;
}
interface TurnoGroup {
  [turno: string]: {
    recordId: string;
    assistants: AssistantGroup[];
  }
}
interface LoteGroup {
  [loteName: string]: TurnoGroup;
}
interface LaborGroup {
  [labor: string]: LoteGroup;
}
interface DayGroup {
  [dateKey: string]: LaborGroup;
}

const getInitialFilters = (): Filters => ({
    campaign: '',
    lote: '',
    labor: '',
    dateRange: { from: undefined, to: undefined },
});

export default function AttendanceDatabasePage() {
  const [records, setRecords] = useState<AttendanceRecordWithId[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { setActions } = useHeaderActions();
  const router = useRouter();
  const { user } = useAuth();
  const { lotes: masterLotes, loading: masterLoading, labors: masterLabors } = useMasterData();
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingData, setEditingData] = useState<{ record: AttendanceRecordWithId; assistant: Assistant } | null>(null);

  const [activeFilters, setActiveFilters] = useState<Filters>(getInitialFilters());
  const [popoverFilters, setPopoverFilters] = useState<Filters>(getInitialFilters());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(user => {
        map.set(user.email, user);
    });
    map.set('marcoromau@gmail.com', {
        email: 'marcoromau@gmail.com',
        nombre: 'Marco Romau',
        rol: 'Admin',
        active: true,
        dni: '00000000',
        celular: '000000000'
    });
    return map;
  }, [users]);


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

        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        const lastModifiedAt = data.lastModifiedAt?.toDate ? data.lastModifiedAt.toDate() : new Date();

        return { id: doc.id, ...data, date, createdAt, lastModifiedAt } as AttendanceRecordWithId;
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
    
    getDocs(collection(db, "usuarios")).then(snapshot => {
        setUsers(snapshot.docs.map(doc => doc.data() as User));
    });

    return () => unsubscribe();
  }, [toast]);

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const { campaign, lote, labor, dateRange } = activeFilters;
      if (campaign && record.campana !== campaign) return false;
      if (lote && record.lotName !== lote) return false;
      if (labor && record.labor !== labor) return false;

      if (dateRange?.from) {
        if (!record.date || record.date < startOfDay(dateRange.from)) return false;
      }
      if (dateRange?.to) {
        if (!record.date || record.date > startOfDay(dateRange.to)) return false;
      }
      return true;
    });
  }, [records, activeFilters]);

  const groupedByDate = useMemo(() => {
    const groups: DayGroup = {};

    for (const record of filteredRecords) {
        if (!record.date || !isValid(record.date)) continue;
        
        const dateKey = format(startOfDay(record.date), 'yyyy-MM-dd');
        const laborKey = record.labor || 'Sin Labor';
        const loteKey = record.lotName || record.lote || 'Sin Lote';
        const turnoKey = record.turno || 'Mañana';

        if (!groups[dateKey]) groups[dateKey] = {};
        if (!groups[dateKey][laborKey]) groups[dateKey][laborKey] = {};
        if (!groups[dateKey][laborKey][loteKey]) groups[dateKey][laborKey][loteKey] = {};
        if (!groups[dateKey][laborKey][loteKey][turnoKey]) {
            groups[dateKey][laborKey][loteKey][turnoKey] = {
                recordId: record.id,
                assistants: [],
            };
        }

        const turnoGroup = groups[dateKey][laborKey][loteKey][turnoKey];
        (record.assistants || []).forEach(assistant => {
            let existingAssistant = turnoGroup.assistants.find(a => a.assistantDni === assistant.assistantDni);
            if (!existingAssistant) {
                existingAssistant = {
                    id: assistant.id,
                    assistantName: assistant.assistantName,
                    assistantDni: assistant.assistantDni,
                    jaladores: {},
                    totalPersonnel: 0,
                    totalAbsent: 0,
                };
                turnoGroup.assistants.push(existingAssistant);
            }
            
            const jaladores = assistant.jaladores || [];
            
            if (jaladores.length > 0) {
                 jaladores.forEach(jalador => {
                    if(!existingAssistant!.jaladores[jalador.jaladorAlias]) {
                        existingAssistant!.jaladores[jalador.jaladorAlias] = [];
                    }
                    existingAssistant!.jaladores[jalador.jaladorAlias].push(jalador);
                });
            } else {
                const placeholderJalador = {
                    id: `empresa-${assistant.id}`,
                    jaladorId: 'empresa',
                    jaladorAlias: 'Jalador Empresa',
                    personnelCount: assistant.personnelCount || 0,
                    absentCount: assistant.absentCount || 0,
                };
                if (!existingAssistant.jaladores['Jalador Empresa']) {
                    existingAssistant.jaladores['Jalador Empresa'] = [];
                }
                existingAssistant.jaladores['Jalador Empresa'].push(placeholderJalador);
            }

            const assistantTotals = (assistant.jaladores && assistant.jaladores.length > 0) 
              ? assistant.jaladores.reduce((acc, j) => {
                  acc.personnelCount += j.personnelCount || 0;
                  acc.absentCount += j.absentCount || 0;
                  return acc;
                }, { personnelCount: 0, absentCount: 0 })
              : { personnelCount: assistant.personnelCount || 0, absentCount: assistant.absentCount || 0 };


            existingAssistant.totalPersonnel += assistantTotals.personnelCount;
            existingAssistant.totalAbsent += assistantTotals.absentCount;
        });
    }
    return groups;
  }, [filteredRecords]);

  const handleEditAssistant = (recordId: string, assistant: Assistant) => {
    const record = records.find(r => r.id === recordId);
    if(record) {
      setEditingData({ record, assistant });
      setIsEditDialogOpen(true);
    }
  };
  
  const handleSaveAssistantUpdate = async (recordId: string, assistantId: string, updatedData: Omit<Assistant, 'id' | 'jaladores'>) => {
    startTransition(async () => {
        const recordRef = doc(db, 'asistencia', recordId);
        const recordToUpdate = records.find(r => r.id === recordId);
        
        if (!recordToUpdate) {
            toast({ variant: "destructive", title: "Error", description: "No se encontró el registro original." });
            return;
        }

        const updatedAssistants = recordToUpdate.assistants.map(a => {
            if (a.id === assistantId) {
                return {
                    ...a,
                    personnelCount: updatedData.personnelCount,
                    absentCount: updatedData.absentCount,
                };
            }
            return a;
        });
        
        const newTotals = updatedAssistants.reduce((acc, a) => {
            const personnel = a.personnelCount || 0;
            const absent = a.absentCount || 0;
            acc.personnelCount += personnel;
            acc.absentCount += absent;
            return acc;
        }, { personnelCount: 0, absentCount: 0 });

        try {
            await updateDoc(recordRef, { 
                assistants: updatedAssistants,
                totals: newTotals,
                lastModifiedBy: user?.email,
                lastModifiedAt: serverTimestamp(),
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

  const handleDownload = useCallback(() => {
    if (filteredRecords.length === 0) {
      toast({ title: 'Sin Datos', description: 'No hay registros que coincidan con los filtros para descargar.' });
      return;
    }

    const dataToExport = filteredRecords.flatMap(record =>
      (record.assistants || []).flatMap(assistant => {
        const base = {
          Fecha: format(record.date, 'dd/MM/yyyy'),
          Turno: record.turno,
          Campaña: record.campana,
          Lote: record.lotName,
          Variedad: record.variedad,
          Cod_Labor: record.code,
          Labor: record.labor,
          Asistente: assistant.assistantName,
          RegistradoPor: userMap.get(record.registeredBy || '')?.nombre || record.registeredBy,
          FechaRegistro: record.createdAt ? format(record.createdAt, 'dd/MM/yyyy HH:mm') : '',
          ModificadoPor: userMap.get(record.lastModifiedBy || '')?.nombre || record.lastModifiedBy,
          FechaMod: record.lastModifiedAt ? format(record.lastModifiedAt, 'dd/MM/yyyy HH:mm') : '',
        };

        if (assistant.jaladores && assistant.jaladores.length > 0) {
          return assistant.jaladores.map(jalador => ({
            ...base,
            Jalador: jalador.jaladorAlias,
            Personal: jalador.personnelCount,
            Faltos: jalador.absentCount,
            LaborApoyada: jalador.supportedLabor || '',
          }));
        }
        
        return [{ ...base, Jalador: 'N/A', Personal: assistant.personnelCount || 0, Faltos: assistant.absentCount || 0, LaborApoyada: '' }];
      })
    );

    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Asistencia");
    xlsx.writeFile(workbook, "BaseDeDatos_Asistencia.xlsx");
    toast({ title: 'Descarga Iniciada', description: 'El archivo de Excel se está descargando.' });

  }, [filteredRecords, userMap, toast]);

  const filterOptions = useMemo(() => {
      const campaigns = [...new Set(records.map(item => item.campana).filter(Boolean))].sort();
      const lotes = [...new Set(records.map(item => item.lotName).filter(Boolean) as string[])].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
      const labors = [...new Set(records.map(item => item.labor).filter(Boolean) as string[])].sort();
      return { campaigns, lotes, labors };
  }, [records]);

  const handleApplyFilters = useCallback(() => {
    setActiveFilters(popoverFilters);
    setIsFilterOpen(false);
  }, [popoverFilters]);
  
  const handleClearFilters = useCallback(() => {
    const cleared = getInitialFilters();
    setPopoverFilters(cleared);
    setActiveFilters(cleared);
    setIsFilterOpen(false);
  }, []);

  useEffect(() => {
    setActions({
      title: "Historial de Asistencia",
      right: (
        <div className="flex items-center gap-1">
           <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Filter className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                  <div className="grid gap-4">
                      <div className="space-y-2"><h4 className="font-medium leading-none">Filtros</h4></div>
                      <div className="grid gap-2">
                          <Label>Campaña</Label>
                          <Select onValueChange={(v) => setPopoverFilters(p => ({...p, campaign: v === 'all' ? '' : v}))} value={popoverFilters.campaign}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                          <Label>Lote</Label>
                          <Select onValueChange={(v) => setPopoverFilters(p => ({...p, lote: v === 'all' ? '' : v}))} value={popoverFilters.lote}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                          <Label>Labor</Label>
                          <Select onValueChange={(v) => setPopoverFilters(p => ({...p, labor: v === 'all' ? '' : v}))} value={popoverFilters.labor}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                          <Label>Rango de Fechas</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={'outline'} className={cn('w-full justify-start text-left font-normal h-9', !popoverFilters.dateRange?.from && 'text-muted-foreground' )}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {popoverFilters.dateRange?.from ? (popoverFilters.dateRange.to ? (<>{format(popoverFilters.dateRange.from, 'LLL dd, y', { locale: es })} - {format(popoverFilters.dateRange.to, 'LLL dd, y', { locale: es })}</>) : (format(popoverFilters.dateRange.from, 'LLL dd, y', { locale: es }))) : (<span>Seleccione un rango</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar initialFocus mode="range" defaultMonth={popoverFilters.dateRange?.from} selected={popoverFilters.dateRange} onSelect={(range) => setPopoverFilters(p => ({...p, dateRange: range}))} numberOfMonths={1} locale={es} />
                            </PopoverContent>
                          </Popover>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                         <Button variant="ghost" size="sm" onClick={handleClearFilters}>Limpiar Filtros</Button>
                         <Button size="sm" onClick={handleApplyFilters}>Aplicar</Button>
                      </div>
                  </div>
              </PopoverContent>
            </Popover>
           <Button variant="ghost" size="icon" onClick={handleDownload} disabled={filteredRecords.length === 0} className="h-9 w-9">
              <FileDown className="h-5 w-5" />
            </Button>
        </div>
      )
    });
    return () => setActions({});
  }, [setActions, router, handleDownload, filteredRecords.length, popoverFilters, filterOptions, isFilterOpen, handleApplyFilters, handleClearFilters]);
  
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
                    const dailyTotalPersonnel = Object.values(laborsForDay).flatMap(lotes => Object.values(lotes).flatMap(turnos => Object.values(turnos).flatMap(t => t.assistants))).reduce((sum, assistant) => sum + assistant.totalPersonnel, 0);
                    const dailyTotalAbsent = Object.values(laborsForDay).flatMap(lotes => Object.values(lotes).flatMap(turnos => Object.values(turnos).flatMap(t => t.assistants))).reduce((sum, assistant) => sum + assistant.totalAbsent, 0);
                    const record = records.find(r => format(startOfDay(r.date), 'yyyy-MM-dd') === dateKey);

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
                                {record && (
                                    <div className="text-xs text-muted-foreground space-y-1 text-right">
                                        <p>Registrado por: {userMap.get(record.registeredBy || '')?.nombre || record.registeredBy || 'N/A'}</p>
                                        <p>Fecha de creación: {record.createdAt ? format(record.createdAt, 'Pp', { locale: es }) : 'N/A'}</p>
                                        {record.lastModifiedBy && (
                                            <>
                                                <p>Última mod. por: {userMap.get(record.lastModifiedBy || '')?.nombre || record.lastModifiedBy}</p>
                                                <p>Fecha de mod.: {record.lastModifiedAt ? format(record.lastModifiedAt, 'Pp', { locale: es }) : 'N/A'}</p>
                                            </>
                                        )}
                                    </div>
                                )}
                                <Accordion type="multiple" className="w-full space-y-2">
                                    {Object.entries(laborsForDay).map(([labor, lotes]) => {
                                        const laborTotalPersonnel = Object.values(lotes).flatMap(turnos => Object.values(turnos).flatMap(t => t.assistants)).reduce((sum, assistant) => sum + assistant.totalPersonnel, 0);
                                        const laborTotalAbsent = Object.values(lotes).flatMap(turnos => Object.values(turnos).flatMap(t => t.assistants)).reduce((sum, assistant) => sum + assistant.totalAbsent, 0);
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
                                                    {Object.entries(lotes).map(([loteName, turnos]) => (
                                                        Object.entries(turnos).map(([turno, turnoData]) => {
                                                            const turnoTotalPersonnel = turnoData.assistants.reduce((sum, a) => sum + a.totalPersonnel, 0);
                                                            const turnoTotalAbsent = turnoData.assistants.reduce((sum, a) => sum + a.totalAbsent, 0);
                                                            return (
                                                                <Collapsible key={`${loteName}-${turno}`} className="border-l-2 border-primary/50 pl-3">
                                                                    <CollapsibleTrigger className="flex justify-between items-center w-full p-2 text-left hover:bg-muted/30 rounded-md">
                                                                        <div className="flex items-center gap-2 text-sm font-medium"><Sprout size={16} />Lote: {loteName} <Badge variant="outline">{turno}</Badge></div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Badge variant="outline">Personal: {turnoTotalPersonnel}</Badge>
                                                                            <Badge variant="destructive" className="bg-red-100 text-red-800">Faltos: {turnoTotalAbsent}</Badge>
                                                                            <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                                                                        </div>
                                                                    </CollapsibleTrigger>
                                                                    <CollapsibleContent className="p-2">
                                                                        <div className="overflow-x-auto border rounded-md">
                                                                            <Table className="text-xs bg-white">
                                                                                <TableHeader><TableRow><TableHead className="w-[50%]">Asistente/Encargado</TableHead><TableHead className="text-center">Personal</TableHead><TableHead className="text-center">Faltos</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                                                                <TableBody>
                                                                                    {turnoData.assistants.map(assistant => (
                                                                                        <Collapsible asChild key={assistant.id}>
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
                                                                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditAssistant(turnoData.recordId, assistant)} disabled={isPending}><Pencil className="h-4 w-4" /></Button>
                                                                                                            <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/80" disabled={isPending}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                                                                                <AlertDialogContent>
                                                                                                                    <AlertDialogHeader><AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle><AlertDialogDescription>Se eliminará al asistente <strong>{assistant.assistantName}</strong> y todo su personal de este registro. Esta acción es permanente.</AlertDialogDescription></AlertDialogHeader>
                                                                                                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteAssistant(turnoData.recordId, assistant.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                                                                                                                </AlertDialogContent>
                                                                                                            </AlertDialog>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <CollapsibleContent>
                                                                                                        <div className="p-2 bg-slate-50">
                                                                                                            <Table><TableHeader><TableRow><TableHead className="h-7">Jalador</TableHead><TableHead className="h-7 text-center">Personal</TableHead><TableHead className="h-7 text-center">Faltos</TableHead></TableRow></TableHeader>
                                                                                                                <TableBody>
                                                                                                                    {Object.entries(assistant.jaladores).map(([jaladorAlias, jaladorRecords]) => {
                                                                                                                        const totalP = jaladorRecords.reduce((s, j) => s + (j.personnelCount || 0), 0);
                                                                                                                        const totalA = jaladorRecords.reduce((s, j) => s + (j.absentCount || 0), 0);
                                                                                                                        return (
                                                                                                                            <TableRow key={jaladorAlias}><TableCell>{jaladorAlias}</TableCell><TableCell className="text-center">{totalP}</TableCell><TableCell className="text-center">{totalA}</TableCell></TableRow>
                                                                                                                        )
                                                                                                                    })}
                                                                                                                </TableBody>
                                                                                                            </Table>
                                                                                                        </div>
                                                                                                    </CollapsibleContent>
                                                                                                </TableCell>
                                                                                            </TableRow>
                                                                                        </Collapsible>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                    </CollapsibleContent>
                                                                </Collapsible>
                                                            )
                                                        })
                                                    ))}
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
                <p className="text-center text-muted-foreground">No se encontraron registros de asistencia para los filtros seleccionados.</p>
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
