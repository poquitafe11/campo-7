
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Calendar as CalendarIcon, RefreshCcw } from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type AttendanceRecord, type LoteData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { AsistentesComparisonTable } from '@/components/AsistentesComparisonTable';


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


function AttendanceSummaryContent({ isClientSide }: { isClientSide: boolean }) {
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [lotesMaestro, setLotesMaestro] = useState<LoteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const selectedDateParam = searchParams.get('date');

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
        
        const records = recordsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
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
  }, [loadData]); 
  
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
        router.push(`?date=${format(date, 'yyyy-MM-dd')}`);
    }
  };

  const pivotData = useMemo<PivotData | null>(() => {
    if (!selectedDate || !lotesMaestro.length) return null;

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const recordsForDay = allRecords.filter(r => r.date === formattedDate);
    
    const uniqueLotesInRecords = [...new Set(recordsForDay.map(r => r.lotName))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const loteHeaders: LoteHeaderInfo[] = uniqueLotesInRecords
      .map(loteNum => {
        const loteDataFromMaestro = lotesMaestro.find(l => l.lote === loteNum);
        const variedad = loteDataFromMaestro?.variedad || 'N/A';
        const fechaCianamida = loteDataFromMaestro?.fechaCianamida;
        const campana = loteDataFromMaestro?.campana || '';

        let ddc: number | string = '';
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
        if (!uniqueLotesInRecords.includes(loteKey)) return;

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
    <div className="space-y-4">
      <div className="flex justify-center my-4">
        <div className="flex items-center gap-2 p-2 border rounded-full shadow-sm bg-background">
          <Button variant="ghost" size="icon" onClick={() => loadData()} className="h-9 w-9">
            <RefreshCcw className="h-5 w-5" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className={cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus locale={es} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <div className="min-w-full overflow-x-auto">
        {pivotData && pivotData.loteHeaders.length > 0 && selectedDate ? (
          <table className="w-full border-collapse text-xs">
              <thead className="text-center font-bold text-black">
                  <tr>
                      <th colSpan={3 + pivotData.loteHeaders.length + 1} className="h-8 border border-black bg-[#fce5cd] p-1 text-base">
                      ASISTENCIA PRODUCCION LOS BRUJOS - CAMPO 7
                      </th>
                  </tr>
                  <tr>
                  <th className="border border-black bg-[#d9e2f3] p-1 whitespace-nowrap" colSpan={2}>Fecha: {format(selectedDate, 'dd/MM/yyyy', { locale: es })}</th>
                      <th className="border border-black bg-[#fff2cc] p-1">DDC</th>
                      {pivotData.loteHeaders.map(h => (
                          <th key={`ddc-h-${h.lote}`} className="border border-black bg-[#fff2cc] p-1 align-middle w-12">{h.ddc}</th>
                      ))}
                      <th className="border border-black bg-[#d9e2f3] p-1 align-middle" rowSpan={3}>TOTAL</th>
                  </tr>
                  <tr>
                      <th className="border border-black bg-[#d9e2f3] p-1 align-middle" rowSpan={2}>COD</th>
                      <th className="border border-black bg-[#d9e2f3] p-1 align-middle" rowSpan={2}>DESCRIPCION DE LABOR</th>
                      <th className="border border-black bg-[#fff2cc] p-1">Lote</th>
                        {pivotData.loteHeaders.map(h => (
                          <th key={`lote-h-${h.lote}`} className="border border-black bg-[#fff2cc] p-1 align-middle w-12">{h.lote}</th>
                      ))}
                  </tr>
                    <tr>
                      <th className="border border-black bg-[#fff2cc] p-1">Var.</th>
                      {pivotData.loteHeaders.map(h => (
                          <th key={`var-h-${h.lote}`} className="border border-black bg-[#fff2cc] p-1 align-middle w-12">{h.variedadAbreviada}</th>
                      ))}
                  </tr>
              </thead>
              <tbody className="text-center bg-white">
                  {Object.keys(pivotData.labors).length > 0 ? (
                      Object.entries(pivotData.labors)
                          .sort(([, valA], [, valB]) => {
                              const codeA = valA.code;
                              const codeB = valB.code;
                              
                              const isSpecialA = codeA === '902' || codeA === '903';
                              const isSpecialB = codeB === '902' || codeB === '903';

                              if (isSpecialA && !isSpecialB) return -1;
                              if (!isSpecialA && isSpecialB) return 1;
                              
                              if (isSpecialA && isSpecialB) {
                                return (Number(codeA) || 0) - (Number(codeB) || 0);
                              }

                              return (Number(codeA) || 9999) - (Number(codeB) || 9999);
                          })
                          .map(([labor, data]) => (
                          <tr key={labor}>
                              <td className="border border-black p-1 w-12">{data.code}</td>
                              <td colSpan={2} className="w-64 border border-black p-1 text-left whitespace-nowrap">{labor}</td>
                              {pivotData.loteHeaders.map(h => (
                                  <td key={`${labor}-${h.lote}`} className="border border-black p-1 w-12">
                                      {data.lotes[h.lote] > 0 ? data.lotes[h.lote] : ''}
                                  </td>
                              ))}
                              <td className="border border-black p-1 font-bold w-14">{data.totalPersonnel > 0 ? data.totalPersonnel : ''}</td>
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
                          <td key={`total-${h.lote}`} className="border border-black p-2 text-center w-12">
                              {pivotData.columnTotals[h.lote] > 0 ? pivotData.columnTotals[h.lote] : ''}
                          </td>
                      ))}
                      <td className="border border-black p-2 text-center w-14">
                        {pivotData.grandTotalPersonnel > 0 ? pivotData.grandTotalPersonnel : ''}
                      </td>
                  </tr>
                  <tr className="bg-[#fce5cd]">
                      <td colSpan={3} className="border border-black p-2 text-center">FALTOS</td>
                      {pivotData.loteHeaders.map(h => (
                          <td key={`faltos-${h.lote}`} className="border border-black p-2 text-center w-12">
                              {pivotData.absentTotalsByLote[h.lote] > 0 ? pivotData.absentTotalsByLote[h.lote] : ''}
                          </td>
                      ))}
                      <td className="border border-black p-2 text-center w-14">
                        {pivotData.grandTotalAbsent > 0 ? pivotData.grandTotalAbsent : ''}
                      </td>
                  </tr>
              </tfoot>
          </table>
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
      </div>
      {isClientSide && <AsistentesComparisonTable allRecords={allRecords} allLotes={lotesMaestro} />}
    </div>
  );
}

function AttendanceSummaryWithClientCheck() {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);

    return <AttendanceSummaryContent isClientSide={isClient} />;
}


export default function AttendanceSummaryPage() {
    return (
        <Suspense fallback={<div className="flex h-48 items-center justify-center rounded-lg border border-dashed"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <AttendanceSummaryWithClientCheck />
        </Suspense>
    )
}
