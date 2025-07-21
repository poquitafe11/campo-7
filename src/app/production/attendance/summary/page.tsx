
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Calendar as CalendarIcon, RefreshCcw } from 'lucide-react';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
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


interface LoteHeaderInfo {
  lote: string;
  cuartel: string;
  ddc: number | string;
  variedadAbreviada: string;
  campana: string;
}

interface PivotData {
  loteHeaders: LoteHeaderInfo[];
  labors: {
    [labor: string]: {
      code?: string;
      lotes: { [cuartel: string]: number };
      totalPersonnel: number;
    };
  };
  columnTotals: { [cuartel: string]: number };
  absentTotalsByLote: { [cuartel: string]: number };
  grandTotalPersonnel: number;
  grandTotalAbsent: number;
}

export default function AttendanceSummaryPage() {
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [lotesMaestro, setLotesMaestro] = useState<LoteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    setIsClient(true);
    // Initialize date on client to avoid hydration errors
    setSelectedDate(new Date());
  }, []);

  const loadData = useCallback(async (showToast = false) => {
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
            // Handle Firestore Timestamp
            const fechaCianamida = data.fechaCianamida?.toDate ? data.fechaCianamida.toDate() : (data.fechaCianamida ? new Date(data.fechaCianamida) : undefined);
            return { id: doc.id, ...data, fechaCianamida } as LoteData
        });
        setLotesMaestro(lotes);

        if (showToast) {
            toast({
                title: 'Datos Actualizados',
                description: 'El resumen ha sido actualizado.'
            });
        }
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

  const pivotData = useMemo<PivotData | null>(() => {
    if (!selectedDate || !lotesMaestro.length) return null;

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const recordsForDay = allRecords.filter(r => r.date === formattedDate);
    
    const lotesInRecords = new Set<string>();
    recordsForDay.forEach(record => {
      lotesInRecords.add(record.lotName);
    });

    const uniqueLotesInMaestro = lotesMaestro
      .filter(l => lotesInRecords.has(l.lote))
      .sort((a, b) => {
        const loteA = parseInt(a.lote, 10);
        const loteB = parseInt(b.lote, 10);
        const cuartelA = parseInt(a.cuartel, 10);
        const cuartelB = parseInt(b.cuartel, 10);
        if (loteA !== loteB) return loteA - loteB;
        return cuartelA - cuartelB;
      });

    if (uniqueLotesInMaestro.length === 0) {
        return { loteHeaders: [], labors: {}, columnTotals: {}, absentTotalsByLote: {}, grandTotalPersonnel: 0, grandTotalAbsent: 0, };
    }
    
    const loteHeaders: LoteHeaderInfo[] = uniqueLotesInMaestro.map(loteData => {
      const variedad = loteData?.variedad || 'N/A';
      const fechaCianamida = loteData?.fechaCianamida;
      const campana = loteData?.campana || '';

      let ddc: number | string = '';
      if (fechaCianamida && isValid(fechaCianamida)) {
          ddc = differenceInDays(selectedDate, fechaCianamida);
      }
      
      const variedadAbreviada = variedad.substring(0, 2).toUpperCase();
      
      return { lote: loteData.lote, cuartel: loteData.cuartel, ddc, variedadAbreviada, campana };
    });

    const labors: PivotData['labors'] = {};
    const columnTotals: { [cuartel: string]: number } = {};
    const absentTotalsByLote: { [cuartel: string]: number } = {};
    let grandTotalPersonnel = 0;
    let grandTotalAbsent = 0;

    loteHeaders.forEach(h => {
      columnTotals[h.cuartel] = 0;
      absentTotalsByLote[h.cuartel] = 0;
    });

    recordsForDay.forEach(record => {
        const loteHeader = loteHeaders.find(h => h.lote === record.lotName);
        if (!loteHeader) return;
        const cuartelKey = loteHeader.cuartel;

        const laborKey = record.labor;
        if (!labors[laborKey]) {
            labors[laborKey] = {
                code: record.code,
                lotes: {},
                totalPersonnel: 0,
            };
            loteHeaders.forEach(h => labors[laborKey].lotes[h.cuartel] = 0);
        }
        
        const personnel = record.totals.personnelCount;
        const absent = record.totals.absentCount;
        
        labors[laborKey].lotes[cuartelKey] = (labors[laborKey].lotes[cuartelKey] || 0) + personnel;
        columnTotals[cuartelKey] += personnel;
        absentTotalsByLote[cuartelKey] += absent;
        
        labors[laborKey].totalPersonnel += personnel;
        grandTotalPersonnel += personnel;
        grandTotalAbsent += absent;
    });

    return { loteHeaders, labors, columnTotals, absentTotalsByLote, grandTotalPersonnel, grandTotalAbsent };
  }, [allRecords, selectedDate, lotesMaestro]);
  
  if (isLoading && !isClient) {
      return (
          <div className="flex min-h-screen w-full flex-col bg-background">
               <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/production/attendance">
                        <ArrowLeft />
                        <span className="sr-only">Volver a Gestión de Asistencia</span>
                        </Link>
                    </Button>
                    <h1 className="flex-1 text-lg font-semibold font-headline sm:text-xl">Resumen de Asistencia</h1>
                </div>
               </header>
               <main className="flex-1 p-4 sm:p-6">
                    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
               </main>
          </div>
      )
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/production/attendance">
              <ArrowLeft />
              <span className="sr-only">Volver a Gestión de Asistencia</span>
            </Link>
          </Button>
           <div>
              <h1 className="text-lg font-semibold font-headline sm:text-xl">Resumen de Asistencia</h1>
           </div>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => loadData(true)} disabled={isLoading} className="h-9 w-9">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              <span className="sr-only">Actualizar</span>
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                  <Button
                      id="date"
                      variant={'outline'}
                      className={cn(
                      'w-[240px] justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                      )}
                  >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {isClient && selectedDate ? format(selectedDate, 'PPP', { locale: es }) : <span>Selecciona una fecha</span>}
                  </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                  {isClient && (
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      locale={es}
                    />
                  )}
              </PopoverContent>
            </Popover>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">
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
                                <th key={`ddc-h-${h.cuartel}`} className="border border-black bg-[#fff2cc] p-1 align-middle">{h.ddc}</th>
                            ))}
                            <th className="border border-black bg-[#d9e2f3] p-1 align-middle" rowSpan={3}>TOTAL</th>
                        </tr>
                        <tr>
                            <th className="border border-black bg-[#d9e2f3] p-1 align-middle" rowSpan={2}>COD</th>
                            <th className="border border-black bg-[#d9e2f3] p-1 align-middle" rowSpan={2}>DESCRIPCION DE LABOR</th>
                            <th className="border border-black bg-[#fff2cc] p-1">Lote</th>
                             {pivotData.loteHeaders.map(h => (
                                <th key={`lote-h-${h.cuartel}`} className="border border-black bg-[#fff2cc] p-1 align-middle">{h.lote}</th>
                            ))}
                        </tr>
                         <tr>
                            <th className="border border-black bg-[#fff2cc] p-1">Var.</th>
                            {pivotData.loteHeaders.map(h => (
                                <th key={`var-h-${h.cuartel}`} className="border border-black bg-[#fff2cc] p-1 align-middle">{h.variedadAbreviada}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="text-center bg-white">
                        {Object.keys(pivotData.labors).length > 0 ? (
                            Object.entries(pivotData.labors)
                                .sort(([, valA], [, valB]) => (Number(valA.code) || 9999) - (Number(valB.code) || 9999))
                                .map(([labor, data]) => (
                                <tr key={labor}>
                                    <td className="border border-black p-1">{data.code}</td>
                                    <td colSpan={2} className="w-72 border border-black p-1 text-left">{labor}</td>
                                    {pivotData.loteHeaders.map(h => (
                                        <td key={`${labor}-${h.cuartel}`} className="border border-black p-1">
                                            {data.lotes[h.cuartel] > 0 ? data.lotes[h.cuartel] : ''}
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
                                <td key={`total-${h.cuartel}`} className="border border-black p-2 text-center">
                                    {pivotData.columnTotals[h.cuartel] > 0 ? pivotData.columnTotals[h.cuartel] : ''}
                                </td>
                            ))}
                            <td className="border border-black p-2 text-center">
                              {pivotData.grandTotalPersonnel > 0 ? pivotData.grandTotalPersonnel : ''}
                            </td>
                        </tr>
                        <tr className="bg-[#fce5cd]">
                            <td colSpan={3} className="border border-black p-2 text-center">FALTOS</td>
                            {pivotData.loteHeaders.map(h => (
                                <td key={`faltos-${h.cuartel}`} className="border border-black p-2 text-center">
                                    {pivotData.absentTotalsByLote[h.cuartel] > 0 ? pivotData.absentTotalsByLote[h.cuartel] : ''}
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
      </main>
    </div>
  );
}
