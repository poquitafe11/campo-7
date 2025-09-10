
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, RefreshCcw, Calendar as CalendarIcon, ArrowLeft, LayoutGrid } from 'lucide-react';
import { format, parseISO, isValid, differenceInDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

import { type AttendanceRecord, type LoteData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';


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
  
  const [secondaryFilters, setSecondaryFilters] = useState({ campaign: '', lote: '' });

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
        </div>
    );
    
    setActions({
        title: headerTitle,
        right: rightComponent,
    });
  
    return () => setActions({});
  }, [setActions, selectedDate, router]);


  const pivotData = useMemo<PivotData | null>(() => {
    if (!selectedDate || !lotesMaestro.length) return null;

    const selectedDayString = format(startOfDay(selectedDate), 'yyyy-MM-dd');
    
    const recordsForDay = allRecords.filter(r => {
        if (!r.date || !isValid(r.date)) return false;
        const recordDayString = format(startOfDay(r.date), 'yyyy-MM-dd');
        return recordDayString === selectedDayString;
    });
    
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

  const secondaryTablesData = useMemo(() => {
    let recordsToProcess = allRecords;
    
    if (secondaryFilters.campaign) {
        recordsToProcess = recordsToProcess.filter(r => r.campana === secondaryFilters.campaign);
    }
    if (secondaryFilters.lote) {
        recordsToProcess = recordsToProcess.filter(r => r.lotName === secondaryFilters.lote);
    }

    const jaladores: { [key: string]: number } = {};
    const labors: { [key: string]: { [jalador: string]: number } } = {};
    const lotes: { [key: string]: { [jalador: string]: number } } = {};

    recordsToProcess.forEach(record => {
        record.assistants.forEach(assistant => {
            (assistant.jaladores || []).forEach(jalador => {
                const jaladorAlias = jalador.jaladorAlias;
                const personnel = jalador.personnelCount;

                jaladores[jaladorAlias] = (jaladores[jaladorAlias] || 0) + personnel;

                // For Resumen por Labor
                const laborKey = record.labor;
                if (!labors[laborKey]) labors[laborKey] = {};
                labors[laborKey][jaladorAlias] = (labors[laborKey][jaladorAlias] || 0) + personnel;

                // For Resumen por Lote
                const loteKey = record.lotName;
                if (!lotes[loteKey]) lotes[loteKey] = {};
                lotes[loteKey][jaladorAlias] = (lotes[loteKey][jaladorAlias] || 0) + personnel;
            });
        });
    });

    const sortedJaladores = Object.keys(jaladores).sort();
    
    return { sortedJaladores, labors, lotes };

  }, [allRecords, secondaryFilters]);

  const filterOptions = useMemo(() => {
        const campaigns = [...new Set(allRecords.map(r => r.campana).filter(Boolean))].sort();
        const lotes = [...new Set(allRecords.map(r => r.lotName).filter(Boolean))].sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
        return { campaigns, lotes };
  }, [allRecords]);
  
  if (isLoading) {
      return (
           <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
      )
  }

  return (
    <div className="p-1 space-y-8">
      {/* Tabla 1: Resumen Diario (INTOCABLE) */}
      <div className="flex justify-center">
        {pivotData && pivotData.loteHeaders.length > 0 && selectedDate ? (
            <div className="inline-block bg-white p-2 shadow-md rounded-lg">
              <table className="table-auto border-collapse text-xs">
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
            <h3 className="text-lg font-semibold">No se encontraron registros</h3>
            <p className="text-sm text-muted-foreground">
              { selectedDate ? "No hay datos de asistencia para el día seleccionado." : "Por favor, seleccione una fecha."}
            </p>
          </div>
        )}
      </div>

      {/* Tablas 2 y 3 */}
      <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Resúmenes Adicionales</CardTitle>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filtros</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="grid gap-4">
                                <Label>Campaña</Label>
                                <Select value={secondaryFilters.campaign} onValueChange={v => setSecondaryFilters(f => ({...f, campaign: v === 'all' ? '' : v}))}>
                                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                </Select>
                                <Label>Lote</Label>
                                <Select value={secondaryFilters.lote} onValueChange={v => setSecondaryFilters(f => ({...f, lote: v === 'all' ? '' : v}))}>
                                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Tabla 2: Resumen por Lote */}
                <div>
                    <h3 className="font-semibold mb-2">Resumen por Lote</h3>
                    {Object.keys(secondaryTablesData.lotes).length > 0 ? (
                        <div className="overflow-x-auto border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Labor</TableHead>
                                        {secondaryTablesData.sortedJaladores.map(j => <TableHead key={j} className="text-center">{j}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.entries(secondaryTablesData.labors).map(([labor, jaladorData]) => (
                                        <TableRow key={labor}>
                                            <TableCell className="font-medium">{labor}</TableCell>
                                            {secondaryTablesData.sortedJaladores.map(jalador => (
                                                <TableCell key={`${labor}-${jalador}`} className="text-center">{jaladorData[jalador] || ''}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">No hay datos para los filtros seleccionados.</p>}
                </div>
                {/* Tabla 3: Resumen por Labor */}
                <div>
                    <h3 className="font-semibold mb-2">Resumen por Labor</h3>
                    {Object.keys(secondaryTablesData.labors).length > 0 ? (
                         <div className="overflow-x-auto border rounded-lg">
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Lote</TableHead>
                                        {secondaryTablesData.sortedJaladores.map(j => <TableHead key={j} className="text-center">{j}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                     {Object.entries(secondaryTablesData.lotes).map(([lote, jaladorData]) => (
                                        <TableRow key={lote}>
                                            <TableCell className="font-medium">{lote}</TableCell>
                                            {secondaryTablesData.sortedJaladores.map(jalador => (
                                                <TableCell key={`${lote}-${jalador}`} className="text-center">{jaladorData[jalador] || ''}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">No hay datos para los filtros seleccionados.</p>}
                </div>
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
