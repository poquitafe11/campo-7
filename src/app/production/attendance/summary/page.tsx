
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent } from '@/components/ui/card';
import { type AttendanceRecord, type LoteData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

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
  }, [loadData, refreshParam]); // Re-run when refreshParam changes

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
           <div className="flex-1 p-4 sm:p-6">
                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
           </div>
      )
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="space-y-4">
        <Card>
          <CardContent className="p-2">
          {pivotData && pivotData.loteHeaders.length > 0 && selectedDate ? (
             <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                    <thead className="text-center font-bold text-black">
                        <tr>
                            <th colSpan={3 + pivotData.loteHeaders.length + 1} className="h-8 border border-black bg-[#fce5cd] p-1 text-base">
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
                                    <td className="border border-black p-1">{data.code}</td>
                                    <td colSpan={2} className="w-72 border border-black p-1 text-left">{labor}</td>
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
                No hay datos de asistencia para el día seleccionado.
              </p>
            </div>
           )}
          </CardContent>
        </Card>
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
