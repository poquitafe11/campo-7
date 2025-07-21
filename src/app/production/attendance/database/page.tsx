
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar as CalendarIcon,
  Users,
  UserX,
  Filter,
  Loader2,
  LayoutGrid
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { type AttendanceRecord, type Assistant } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import EditAssistantDialog from '@/components/edit-assistant-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, arrayRemove, deleteDoc } from 'firebase/firestore';
import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";
import { useRouter } from 'next/navigation';


interface GroupedByLaborLot {
  labor: string;
  lotName: string;
  totalPersonnel: number;
  totalAbsent: number;
  records: AttendanceRecord[];
}

interface GroupedByDate {
  date: string;
  totalPersonnel: number;
  totalAbsent: number;
  details: GroupedByLaborLot[];
}

interface DynamicFilterOptions {
  lots: string[];
  labors: string[];
  assistants: string[];
}

const getInitialFilters = () => ({
  dateRange: { from: undefined, to: undefined } as DateRange,
  labor: '',
  lotName: '',
  assistantName: '',
});

export default function AttendanceDatabasePage() {
  const router = useRouter();
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<GroupedByDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [
    editingAssistant,
    setEditingAssistant,
  ] = useState<{ record: AttendanceRecord; assistant: Assistant } | null>(null);

  const { toast } = useToast();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(getInitialFilters());
  const [popoverFilters, setPopoverFilters] = useState(getInitialFilters());

  const [dynamicOptions, setDynamicOptions] = useState<DynamicFilterOptions>({
    lots: [],
    labors: [],
    assistants: [],
  });
  
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    if (!db) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Firebase no está disponible.',
        });
        setIsLoading(false);
        return;
    }
    try {
        const querySnapshot = await getDocs(collection(db, 'asistencia'));
        const records = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
        setAllRecords(records);
    } catch (error) {
        console.error("Error loading attendance records: ", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudieron cargar los registros de asistencia.',
        });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);
  
  useEffect(() => {
    if (isLoading) return;

    let filtered = allRecords;

    if (activeFilters.dateRange.from) {
      const fromDate = format(activeFilters.dateRange.from, 'yyyy-MM-dd');
      filtered = filtered.filter(r => r.date >= fromDate);
    }
    if (activeFilters.dateRange.to) {
        const toDate = format(activeFilters.dateRange.to, 'yyyy-MM-dd');
        filtered = filtered.filter(r => r.date <= toDate);
    }
    if (activeFilters.lotName) {
      filtered = filtered.filter(r => r.lotName === activeFilters.lotName);
    }
    if (activeFilters.labor) {
      filtered = filtered.filter(r => r.labor === activeFilters.labor);
    }
    if (activeFilters.assistantName) {
      filtered = filtered.filter(r => r.assistants.some(a => a.assistantName === activeFilters.assistantName));
    }

    const groupedByDate: { [date: string]: AttendanceRecord[] } = filtered.reduce((acc, record) => {
        (acc[record.date] = acc[record.date] || []).push(record);
        return acc;
    }, {} as { [date: string]: AttendanceRecord[] });

    const processedData = Object.entries(groupedByDate).map(([date, records]) => {
        const validRecords = records.filter(r => r.assistants && r.assistants.length > 0);

        if (validRecords.length === 0) {
          return null;
        }
        
        let totalPersonnel = 0;
        let totalAbsent = 0;
        
        const detailsGrouped = validRecords.reduce((acc, record) => {
          const key = `${record.labor}-${record.lotName}`;
          if (!acc[key]) {
            acc[key] = {
              labor: record.labor,
              lotName: record.lotName || 'N/A',
              totalPersonnel: 0,
              totalAbsent: 0,
              records: []
            };
          }
          acc[key].records.push(record);
          totalPersonnel += record.totals.personnelCount;
          totalAbsent += record.totals.absentCount;
          acc[key].totalPersonnel += record.totals.personnelCount;
          acc[key].totalAbsent += record.totals.absentCount;
          return acc;
        }, {} as Record<string, GroupedByLaborLot>)

        return {
            date,
            totalPersonnel,
            totalAbsent,
            details: Object.values(detailsGrouped)
        };
    }).filter((item): item is GroupedByDate => item !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setDailyRecords(processedData);
}, [allRecords, isLoading, activeFilters]);

  const uniqueOptions = useMemo(() => {
    if (isLoading) return { lots: [], labors: [], assistants: [] };
    let filtered = allRecords;

    if (popoverFilters.dateRange.from) {
      const fromDate = format(popoverFilters.dateRange.from, 'yyyy-MM-dd');
      filtered = filtered.filter(r => r.date >= fromDate);
    }
    if (popoverFilters.dateRange.to) {
        const toDate = format(popoverFilters.dateRange.to, 'yyyy-MM-dd');
        filtered = filtered.filter(r => r.date <= toDate);
    }
    
    const lots = [...new Set(filtered.map(r => r.lotName).filter(Boolean) as string[])];
    const labors = [...new Set(filtered.map(r => r.labor))];
    const assistants = [...new Set(filtered.flatMap(r => r.assistants.map(a => a.assistantName)))];
    
    return { lots, labors, assistants };
  }, [popoverFilters.dateRange, allRecords, isLoading]);

  useEffect(() => {
    setDynamicOptions(uniqueOptions);
  }, [uniqueOptions]);

  const handleDeleteAssistant = async (recordId: string, assistantToDelete: Assistant) => {
    if (!db) return;
    try {
        const recordRef = doc(db, 'asistencia', recordId);
        const record = allRecords.find(r => r.id === recordId);

        if (!record) {
            toast({ variant: 'destructive', title: 'Error', description: 'Registro no encontrado.' });
            return;
        }

        // If this is the last assistant in the record, delete the whole document.
        if (record.assistants.length === 1) {
            await deleteDoc(recordRef);
            toast({ title: 'Éxito', description: 'Registro de asistencia eliminado.' });
        } else {
            // Otherwise, just remove the assistant and update totals.
            const newPersonnelCount = (record.totals.personnelCount || 0) - assistantToDelete.personnelCount;
            const newAbsentCount = (record.totals.absentCount || 0) - assistantToDelete.absentCount;
            await updateDoc(recordRef, {
                assistants: arrayRemove(assistantToDelete),
                "totals.personnelCount": newPersonnelCount,
                "totals.absentCount": newAbsentCount,
            });
            toast({ title: 'Éxito', description: 'Asistente eliminado del registro.' });
        }
        loadInitialData();
    } catch (error) {
        console.error("Error deleting assistant from record: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la eliminación.' });
    }
  };

  const handleSaveAssistant = async (
    recordId: string,
    assistantId: string,
    updatedData: Omit<Assistant, 'id'>
  ) => {
    if (!db) return;
    try {
        const recordRef = doc(db, 'asistencia', recordId);
        const record = allRecords.find(r => r.id === recordId);
        if (!record) return;

        const newAssistants = record.assistants.map(a => a.id === assistantId ? { ...updatedData, id: assistantId } : a);
        const newTotals = newAssistants.reduce((acc, curr) => {
            acc.personnelCount += curr.personnelCount;
            acc.absentCount += curr.absentCount;
            return acc;
        }, { personnelCount: 0, absentCount: 0 });

        await updateDoc(recordRef, { assistants: newAssistants, totals: newTotals });
        toast({ title: 'Éxito', description: 'Registro actualizado.' });
        loadInitialData();
    } catch (error) {
        console.error("Error updating assistant: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el registro.' });
    } finally {
        setEditingAssistant(null);
    }
  };

  const handleApplyFilters = () => {
    setActiveFilters(popoverFilters);
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    const clearedFilters = getInitialFilters();
    setPopoverFilters(clearedFilters);
    setActiveFilters(clearedFilters);
    setIsFilterOpen(false);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
        <h1 className="text-xl font-semibold">
          Historial de Asistencia
        </h1>
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Retroceder</span>
            </Button>
            <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard">
                    <LayoutGrid className="h-5 w-5" />
                    <span className="sr-only">Menú Principal</span>
                </Link>
            </Button>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Registros por Fecha</CardTitle>
                <CardDescription>
                  Consulta, filtra y gestiona los registros de asistencia diarios.
                </CardDescription>
              </div>
              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                  >
                    <Filter className="h-4 w-4" />
                    <span className="sr-only">Filtrar</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[90vw] max-w-sm p-4 sm:w-auto" align="end">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Filtros</h4>
                      <p className="text-sm text-muted-foreground">
                        Ajusta los filtros para ver registros específicos.
                      </p>
                    </div>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label>Rango de Fechas</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id="date"
                              variant={'outline'}
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !popoverFilters.dateRange?.from &&
                                  'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {popoverFilters.dateRange?.from ? (
                                popoverFilters.dateRange.to ? (
                                  <>
                                    {format(
                                      popoverFilters.dateRange.from,
                                      'LLL dd, y',
                                      { locale: es }
                                    )}{' '}
                                    -{' '}
                                    {format(
                                      popoverFilters.dateRange.to,
                                      'LLL dd, y',
                                      { locale: es }
                                    )}
                                  </>
                                ) : (
                                  format(
                                    popoverFilters.dateRange.from,
                                    'LLL dd, y',
                                    { locale: es }
                                  )
                                )
                              ) : (
                                <span>Seleccione un rango</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              initialFocus
                              mode="range"
                              defaultMonth={popoverFilters.dateRange?.from}
                              selected={popoverFilters.dateRange}
                              onSelect={(range) => {
                                setPopoverFilters((prev) => ({
                                  ...prev,
                                  dateRange:
                                    range || { from: undefined, to: undefined },
                                }));
                              }}
                              numberOfMonths={1}
                              locale={es}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="grid grid-cols-1 items-center gap-2">
                        <Label htmlFor="lotName">Lote</Label>
                        <Select
                          value={popoverFilters.lotName}
                          onValueChange={(value) =>
                            setPopoverFilters((prev) => ({
                              ...prev,
                              lotName: value === 'all' ? '' : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {dynamicOptions.lots.map((lot) => (
                              <SelectItem key={lot} value={lot}>
                                {lot}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 items-center gap-2">
                        <Label htmlFor="labor">Labor</Label>
                        <Select
                          value={popoverFilters.labor}
                          onValueChange={(value) =>
                            setPopoverFilters((prev) => ({
                              ...prev,
                              labor: value === 'all' ? '' : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {dynamicOptions.labors.map((labor) => (
                              <SelectItem key={labor} value={labor}>
                                {labor}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 items-center gap-2">
                        <Label htmlFor="assistantName">Asistente</Label>
                        <Select
                          value={popoverFilters.assistantName}
                          onValueChange={(value) =>
                            setPopoverFilters((prev) => ({
                              ...prev,
                              assistantName: value === 'all' ? '' : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {dynamicOptions.assistants.map((assistant) => (
                              <SelectItem key={assistant} value={assistant}>
                                {assistant}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilters}
                      >
                        Limpiar
                      </Button>
                      <Button size="sm" onClick={handleApplyFilters}>
                        Aplicar
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : dailyRecords.length > 0 ? (
              <Accordion type="multiple" className="w-full space-y-2">
                {dailyRecords.map((day) => (
                  <AccordionItem
                    value={day.date}
                    key={day.date}
                    className="rounded-lg border bg-card/50"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex w-full flex-col items-start gap-1 text-left sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-5 w-5 text-primary" />
                          <p className="text-lg font-semibold">
                            {format(parseISO(day.date), 'PPP', { locale: es })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 pr-2 text-sm sm:items-center">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>
                              Total Personas:{' '}
                              <span className="font-bold text-foreground">
                                {day.totalPersonnel}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <UserX className="h-4 w-4" />
                            <span>
                              Total Faltos:{' '}
                              <span className="font-bold text-foreground">
                                {day.totalAbsent}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {day.details.map((detail, index) => (
                        <div key={index} className="mt-2 rounded-md border p-4">
                          <h4 className="font-semibold">{detail.labor} - {detail.lotName}</h4>
                           <Table>
                             <TableHeader>
                               <TableRow>
                                 <TableHead>Asistente</TableHead>
                                 <TableHead>Personal</TableHead>
                                 <TableHead>Faltos</TableHead>
                                 <TableHead className="text-right">Acciones</TableHead>
                               </TableRow>
                             </TableHeader>
                             <TableBody>
                               {detail.records.flatMap(r => r.assistants).map(assistant => (
                                 <TableRow key={assistant.id}>
                                   <TableCell>{assistant.assistantName}</TableCell>
                                   <TableCell>{assistant.personnelCount}</TableCell>
                                   <TableCell>{assistant.absentCount}</TableCell>
                                   <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingAssistant({ record: detail.records.find(r => r.assistants.some(a => a.id === assistant.id))!, assistant })}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                           <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                              <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                            <AlertDialogDescription>Esta acción eliminará a este asistente de este registro de asistencia. No se puede deshacer.</AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteAssistant(detail.records.find(r => r.assistants.some(a => a.id === assistant.id))!.id, assistant)}>Eliminar</AlertDialogAction>
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
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="flex h-24 flex-col items-center justify-center rounded-lg border border-dashed text-center">
                <h3 className="text-lg font-semibold">
                  No se encontraron registros
                </h3>
                <p className="text-sm text-muted-foreground">
                  Intenta ajustar los filtros o registra nueva asistencia.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <EditAssistantDialog
        isOpen={!!editingAssistant}
        setIsOpen={() => setEditingAssistant(null)}
        editingData={editingAssistant}
        onSave={handleSaveAssistant}
      />
    </div>
  );
}
