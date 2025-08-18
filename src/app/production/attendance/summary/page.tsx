
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, RefreshCcw, Calendar as CalendarIcon, ArrowLeft, LayoutGrid } from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent } from '@/components/ui/card';
import { type AttendanceRecord, type LoteData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';

interface LoteHeaderInfo {
  lote: string; 
  ddc: number | string;
  variedadAbreviada: string;
  campana: string;
}

interface PivotData {
  loteHeaders: LoteHeaderInfo[];
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

function AttendanceSummaryContent() {
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [lotesMaestro, setLotesMaestro] = useState<LoteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setActions } = useHeaderActions();
  
  const selectedDateParam = searchParams.get('date');
  const refreshParam = searchParams.get('refresh'); 

  const selectedDate = useMemo(() => {
    // Default to today if no date is in the URL
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
          const date = data.date;
          return { id: doc.id, ...data, date: date } as AttendanceRecord;
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
  }, [loadData, refreshParam, selectedDate]); 

  useEffect(() => {
    const headerTitle = (
        <div className="flex items-center justify-center leading-tight">
            <span className="text-sm font-normal text-muted-foreground whitespace-nowrap">Resumen de&nbsp;</span>
            <h1 className="text-lg font-bold text-foreground">Asistencia</h1>
        </div>
    );

    const leftComponent = (
        <div className="flex justify-start">
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
        </div>
    );

    const rightComponent = (
        <div className="flex justify-end items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/production/attendance/summary?date=${format(selectedDate, 'yyyy-MM-dd')}&refresh=${Date.now()}`)} className="h-8 w-8">
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
                        onSelect={(date) => router.push(`/production/attendance/summary?date=${format(date!, 'yyyy-MM-dd')}`)}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                <Link href="/dashboard">
                    <LayoutGrid className="h-5 w-5" />
                </Link>
            </Button>
        </div>
    );
    
    setActions({
        left: leftComponent,
        center: headerTitle,
        right: rightComponent,
    });
  
    return () => setActions({});
  }, [setActions, selectedDate, router]);


  const pivotData = useMemo<PivotData | null>(() => {
    if (!selectedDate || !lotesMaestro.length) return null;

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const recordsForDay = allRecords.filter(r => r.date === formattedDate);
    
    const uniqueLotesInRecords = [...new Set(recordsForDay.map(r => r.lotName))].filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const loteHeaders: LoteHeaderInfo[] = uniqueLotesInRecords
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
  }, [allRecords, selectedDate, lotesMaestro]);
  
  if (isLoading) {
      return (
           <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
      )
  }

  return (
    <Card>
      <CardContent className="p-0">
      {pivotData && pivotData.loteHeaders.length > 0 && selectedDate ? (
          <div className="w-full">
            <table className="w-full border-collapse text-xs table-fixed">
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
                    {Object.keys(pivotData.labors).length > 0 ? (
                        Object.entries(pivotData.labors)
                            .sort(([, valA], [, valB]) => {
                                const codeA = valA.code;
                                const codeB = valB.code;
                                
                                const getSortPriority = (code?: string) => {
                                    if (code === '902') return 1;
                                    if (code === '903') return 2;
                                    const num = Number(code);
                                    return isNaN(num) ? 9999 : num + 2;
                                };

                                const priorityA = getSortPriority(codeA);
                                const priorityB = getSortPriority(codeB);

                                return priorityA - priorityB;
                            })
                            .map(([labor, data]) => (
                            <tr key={labor}>
                                <td className="border border-black p-1">{data.code}</td>
                                <td colSpan={2} className="w-auto border border-black p-1 text-left whitespace-normal">{labor}</td>
                                {pivotData.loteHeaders.map(h => (
                                    <td key={`${labor}-${h.lote}`} className="border border-black p-1">
                                        {data.lotes[h.lote] > 0 ? data.lotes[h.lote] : ''}
                                    </td>
                                ))}
                                <td className="border border-black p-1 font-bold">{data.totalPersonnel > 0 ? data.totalPersonnel : ''}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={4 + pivotData.loteHeaders.length} className="h-24 text-center text-muted-foreground">No hay datos de labores para este día.</td>
                        </tr>
                    )}
                </tbody>
                <tfoot className="font-bold text-black text-center">
                    <tr className="bg-[#fce5cd]">
                        <td colSpan={3} className="border border-black p-2 text-center">TOTAL</td>
                        {pivotData.loteHeaders.map(h => (
                            <td key={`total-${h.lote}`} className="border border-black p-2 text-center">
                                {pivotData.columnTotals[h.lote] > 0 ? pivotData.columnTotals[h.lote] : ''}
                            </td>
                        ))}
                        <td className="border border-black p-2 text-center">
                          {pivotData.grandTotalPersonnel > 0 ? pivotData.grandTotalPersonnel : ''}
                        </td>
                    </tr>
                    <tr className="bg-[#fce5cd]">
                        <td colSpan={3} className="border border-black p-2 text-center">FALTOS</td>
                        {pivotData.loteHeaders.map(h => (
                            <td key={`faltos-${h.lote}`} className="border border-black p-2 text-center">
                                {pivotData.absentTotalsByLote[h.lote] > 0 ? pivotData.absentTotalsByLote[h.lote] : ''}
                            </td>
                        ))}
                        <td className="border border-black p-2 text-center">
                          {pivotData.grandTotalAbsent > 0 ? pivotData.grandTotalAbsent : ''}
                        </td>
                    </tr>
                </tfoot>
            </table>
          </div>
      ) : (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed text-center">
          <h3 className="text-lg font-semibold">
            No se encontraron registros
          </h3>
          <p className="text-sm text-muted-foreground">
            { selectedDate ? "No hay datos de asistencia para el día seleccionado." : "Por favor, seleccione una fecha."}
          </p>
        </div>
        )}
      </CardContent>
    </Card>
  );
}


export default function AttendanceSummaryPage() {
    return (
        <Suspense fallback={<div className="flex h-48 items-center justify-center rounded-lg border border-dashed"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <AttendanceSummaryContent />
        </Suspense>
    )
}
