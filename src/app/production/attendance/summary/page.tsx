
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, RefreshCcw, Calendar as CalendarIcon, ArrowLeft, LayoutGrid, Clock } from 'lucide-react';
import { format, parseISO, isValid, differenceInDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

import { type AttendanceRecord, type LoteData, type Labor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';
import { ResumenTablasAdicionales } from '@/components/ResumenTablasAdicionales';
import { useMasterData } from '@/context/MasterDataContext';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';


interface PivotData {
  loteHeaders: {
    lote: string; 
    ddc: number | string;
    variedadAbreviada: string;
    campana: string;
  }[];
  labors: {
    [labor: string]: {
      code?: string;
      lotes: { [lote: string]: number }; 
      totalPersonnel: number;
    };
  };
  columnTotals: { [lote: string]: number };
  absentTotalsByLote: { [lote: string]: number };
  grandTotalPersonnel: number;
  grandTotalAbsent: number;
}

const formatAssistantName = (name: string) => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length < 2) return name;
    const firstName = parts[0];
    const lastNameInitial = parts[parts.length - 1].charAt(0).toUpperCase() + '.';
    return `${firstName} ${lastNameInitial}`;
};


function AttendanceSummaryContent() {
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [lotesMaestro, setLotesMaestro] = useState<LoteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setActions } = useHeaderActions();
  const { labors } = useMasterData();
  const [turnoFilter, setTurnoFilter] = useState('todos');
  
  const selectedDateParam = searchParams.get('date');
  const refreshParam = searchParams.get('refresh'); 
  
  const selectedDate = useMemo(() => {
    if (selectedDateParam && isValid(parseISO(selectedDateParam))) {
      return parseISO(selectedDateParam);
    }
    return new Date();
  }, [selectedDateParam]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    if (!db) {
        toast({ 
            variant: 'destructive',
            title: 'Error de Conexión', 
            description: 'No se pudieron cargar los datos.' 
        });
        setIsLoading(false);
        return;
    }
    try {
        const [recordsSnapshot, lotesSnapshot] = await Promise.all([
          getDocs(collection(db, 'asistencia')),
          getDocs(collection(db, 'maestro-lotes'))
        ]);
        
        const records = recordsSnapshot.docs.map(doc => {
          const data = doc.data();
          let date;
          if (data.date?.toDate) {
              date = data.date.toDate();
          } else if (typeof data.date === 'string' && isValid(parseISO(data.date))) {
              date = parseISO(data.date);
          } else {
              date = new Date();
          }
          return { id: doc.id, ...data, date } as AttendanceRecord;
        });
        setAllRecords(records);
        
        const lotes = lotesSnapshot.docs.map(doc => {
            const data = doc.data();
            const fechaCianamida = data.fechaCianamida?.toDate ? data.fechaCianamida.toDate() : (data.fechaCianamida ? parseISO(data.fechaCianamida) : undefined);
            return { id: doc.id, ...data, fechaCianamida } as LoteData
        });
        setLotesMaestro(lotes);

    } catch (error) {
        console.error("Error loading data: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    loadData();
  }, [loadData, refreshParam]);

  useEffect(() => {
    const headerTitle = (
        <div className="flex flex-col items-center justify-center leading-tight">
            <span className="text-sm font-normal text-muted-foreground whitespace-nowrap">Resumen de</span>
            <h1 className="text-lg font-bold text-foreground">Asistencia</h1>
        </div>
    );

    const rightComponent = (
        <div className="flex justify-end items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => router.replace(`/production/attendance/summary?date=${format(selectedDate, 'yyyy-MM-dd')}&refresh=${Date.now()}`)} className="h-8 w-8">
                <RefreshCcw className="h-5 w-5" />
            </Button>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" className="gap-1 px-2 h-8">
                        <CalendarIcon className="h-5 w-5" />
                        <span className="text-sm">{format(selectedDate, "d MMM yyyy", { locale: es })}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => router.replace(`/production/attendance/summary?date=${format(date!, 'yyyy-MM-dd')}`)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" className="gap-1 px-2 h-8">
                        <Clock className="h-5 w-5" />
                        <span className="text-sm capitalize">{turnoFilter === 'todos' ? 'Todos' : turnoFilter}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-0" align="end">
                    <div className="p-2">
                        {['todos', 'Mañana', 'Tarde', 'Noche'].map(turno => (
                            <div key={turno} onClick={() => setTurnoFilter(turno)} className="px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer">
                                {turno === 'todos' ? 'Todos los Turnos' : turno}
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
    
    setActions({
        title: headerTitle,
        backUrl: '/production/attendance',
        right: rightComponent,
    });
  
    return () => setActions({});
  }, [setActions, selectedDate, router, turnoFilter]);


  const recordsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const selectedDayString = format(startOfDay(selectedDate), 'yyyy-MM-dd');
    
    let filtered = allRecords.filter(r => {
        if (!r.date || !isValid(r.date)) return false;
        const recordDayString = format(startOfDay(r.date), 'yyyy-MM-dd');
        return recordDayString === selectedDayString;
    });

    if (turnoFilter !== 'todos') {
        filtered = filtered.filter(r => (r.turno || 'Mañana') === turnoFilter);
    }
    
    return filtered;

  }, [allRecords, selectedDate, turnoFilter]);


  const pivotData = useMemo<PivotData | null>(() => {
    if (!selectedDate || !lotesMaestro.length) return null;
    
    const recordsForDay = recordsForSelectedDate;
    
    const uniqueLotesInRecords = [...new Set(recordsForDay.map(r => r.lotName))].filter(Boolean) as string[];
    uniqueLotesInRecords.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const loteHeaders: PivotData['loteHeaders'] = uniqueLotesInRecords
      .map(loteNum => {
        const loteDataFromMaestro = lotesMaestro.find(l => l.lote === loteNum);
        const variedad = loteDataFromMaestro?.variedad || 'N/A';
        const fechaCianamida = loteDataFromMaestro?.fechaCianamida;
        const campana = loteDataFromMaestro?.campana || '';

        let ddc: number | string = 'N/A';
        if (fechaCianamida && isValid(fechaCianamida)) {
            ddc = differenceInDays(selectedDate, fechaCianamida);
        }
        
        const variedadAbreviada = variedad.substring(0, 2).toUpperCase();
        
        return { lote: loteNum, ddc, variedadAbreviada, campana };
      });

    if (loteHeaders.length === 0) {
        return { loteHeaders: [], labors: {}, columnTotals: {}, absentTotalsByLote: {}, grandTotalPersonnel: 0, grandTotalAbsent: 0 };
    }

    const labors: PivotData['labors'] = {};
    const columnTotals: { [lote: string]: number } = {};
    const absentTotalsByLote: { [lote: string]: number } = {};
    let grandTotalPersonnel = 0;
    let grandTotalAbsent = 0;

    loteHeaders.forEach(h => {
      columnTotals[h.lote] = 0;
      absentTotalsByLote[h.lote] = 0;
    });

    recordsForDay.forEach(record => {
        const loteKey = record.lotName;
        if (!loteKey || !uniqueLotesInRecords.includes(loteKey)) return;

        const laborKey = record.labor;
        if (!labors[laborKey]) {
            labors[laborKey] = {
                code: record.code,
                lotes: {},
                totalPersonnel: 0,
            };
            loteHeaders.forEach(h => labors[laborKey].lotes[h.lote] = 0);
        }
        
        const personnel = record.totals.personnelCount;
        const absent = record.totals.absentCount;

        labors[laborKey].lotes[loteKey] = (labors[laborKey].lotes[loteKey] || 0) + personnel;
        columnTotals[loteKey] += personnel;
        absentTotalsByLote[loteKey] += absent;
        
        labors[laborKey].totalPersonnel += personnel;
        grandTotalPersonnel += personnel;
        grandTotalAbsent += absent;
    });

    return { loteHeaders, labors, columnTotals, absentTotalsByLote, grandTotalPersonnel, grandTotalAbsent };
  }, [recordsForSelectedDate, selectedDate, lotesMaestro]);

  if (isLoading) {
      return (
           <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="w-full">
        <div className="bg-white p-2 rounded-lg shadow-sm border inline-block min-w-full">
            {pivotData && pivotData.loteHeaders.length > 0 && selectedDate ? (
                <table className="table-auto border-collapse text-xs w-full">
                    <thead className="text-center font-bold text-black">
                        <tr>
                            <th colSpan={3 + pivotData.loteHeaders.length + 1} className="h-8 border border-black bg-[#fce5cd] p-1 text-xs">
                            ASISTENCIA PRODUCCION LOS BRUJOS - CAMPO 7
                            </th>
                        </tr>
                        <tr>
                        <th className="border border-black bg-[#d9e2f3] p-1" colSpan={2}>Fecha: {format(selectedDate, 'dd/MM/yyyy')}</th>
                            <th className="border border-black bg-[#fff2cc] p-1">DDC</th>
                            {pivotData.loteHeaders.map(h => (
                                <th key={`ddc-h-${h.lote}`} className="border border-black bg-[#fff2cc] p-1 align-middle">{h.ddc}</th>
                            ))}
                            <th className="border border-black bg-[#d9e2f3] p-1 align-middle" rowSpan={3}>TOTAL</th>
                        </tr>
                        <tr>
                            <th className="border border-black bg-[#d9e2f3] p-1 align-middle" rowSpan={2}>COD</th>
                            <th className="border border-black bg-[#d9e2f3] p-1 align-middle" rowSpan={2}>DESCRIPCION DE LABOR</th>
                            <th className="border border-black bg-[#fff2cc] p-1">Lote</th>
                                {pivotData.loteHeaders.map(h => (
                                <th key={`lote-h-${h.lote}`} className="border border-black bg-[#fff2cc] p-1 align-middle">{h.lote}</th>
                            ))}
                        </tr>
                            <tr>
                            <th className="border border-black bg-[#fff2cc] p-1">Var.</th>
                            {pivotData.loteHeaders.map(h => (
                                <th key={`var-h-${h.lote}`} className="border border-black bg-[#fff2cc] p-1 align-middle">{h.variedadAbreviada}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="text-center bg-white">
                        {Object.entries(pivotData.labors).map(([labor, data]) => (
                            <tr key={labor}>
                                <td className="p-1 border border-black">{data.code}</td>
                                <td colSpan={2} className="w-auto p-1 text-left whitespace-normal border border-black">{labor}</td>
                                {pivotData.loteHeaders.map(h => (
                                    <td key={`${labor}-${h.lote}`} className="p-1 text-center border border-black">
                                        {data.lotes[h.lote] > 0 ? data.lotes[h.lote] : ''}
                                    </td>
                                ))}
                                <td className="p-1 font-bold text-center border border-black">{data.totalPersonnel > 0 ? data.totalPersonnel : ''}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="font-bold text-black text-center">
                        <tr className="bg-[#fce5cd]">
                            <td colSpan={3} className="p-2 text-center border border-black">TOTAL</td>
                            {pivotData.loteHeaders.map(h => (
                                <td key={`total-${h.lote}`} className="p-2 text-center border border-black">
                                    {pivotData.columnTotals[h.lote] > 0 ? pivotData.columnTotals[h.lote] : ''}
                                </td>
                            ))}
                            <td className="p-2 text-center border border-black">
                                {pivotData.grandTotalPersonnel > 0 ? pivotData.grandTotalPersonnel : ''}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            ) : (
            <div className="flex h-48 flex-col items-center justify-center rounded-lg border-dashed text-center">
                <h3 className="text-lg font-semibold">No se encontraron registros</h3>
                <p className="text-sm text-muted-foreground">
                { selectedDate ? "No hay datos de asistencia para el día seleccionado." : "Por favor, seleccione una fecha."}
                </p>
            </div>
            )}
        </div>
      </div>
      
      <div className="max-w-full">
        <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-primary" />}>
          <ResumenTablasAdicionales allRecords={allRecords} allLotes={lotesMaestro} allLabors={labors} selectedDate={selectedDate}/>
        </Suspense>
      </div>
    </div>
  );
}


export default function AttendanceSummaryPage() {
    return (
        <Suspense fallback={<div className="flex h-48 items-center justify-center rounded-lg border border-dashed"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <AttendanceSummaryContent />
        </Suspense>
    )
}
