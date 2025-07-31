
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Filter } from 'lucide-react';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { type AttendanceRecord, type LoteData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';


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

interface AsistenteComparisonFilters {
  campaign: string;
  labor: string;
  lote: string;
}

interface ComparisonDay {
  date: Date;
  label: string;
}

function AsistentesComparisonTable({ allRecords, allLotes }: { allRecords: AttendanceRecord[], allLotes: LoteData[] }) {
    const [filters, setFilters] = useState<AsistenteComparisonFilters>({ campaign: '', labor: '', lote: '' });
    const [popoverFilters, setPopoverFilters] = useState<AsistenteComparisonFilters>({ campaign: '', labor: '', lote: '' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const filterOptions = useMemo(() => {
        const campaigns = [...new Set(allRecords.map(r => r.campana).filter(Boolean))].sort();
        const labors = [...new Set(allRecords.map(r => r.labor).filter(Boolean))].sort();
        const lotes = [...new Set(allRecords.map(r => r.lotName).filter(Boolean))].sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
        return { campaigns, labors, lotes };
    }, [allRecords]);
    
    const comparisonData = useMemo(() => {
        if (!filters.campaign && !filters.labor && !filters.lote) {
            return { comparisonDays: [], data: new Map() };
        }

        const filteredRecords = allRecords.filter(r => 
            (!filters.campaign || r.campana === filters.campaign) &&
            (!filters.labor || r.labor === filters.labor) &&
            (!filters.lote || r.lotName === filters.lote)
        );

        if (filteredRecords.length === 0) {
            return { comparisonDays: [], data: new Map() };
        }

        const uniqueDates = [...new Set(filteredRecords.map(r => r.date))].sort().reverse();
        const comparisonDays: ComparisonDay[] = uniqueDates.slice(0, 4).map(dateStr => ({
            date: parseISO(dateStr),
            label: format(parseISO(dateStr), 'dd MMM', { locale: es })
        }));
        
        const data = new Map<string, { [dateLabel: string]: number }>();
        const allAssistants = [...new Set(filteredRecords.flatMap(r => r.assistants.map(a => a.assistantName)))].sort();

        allAssistants.forEach(assistantName => {
            const row: { [dateLabel: string]: number } = {};
            comparisonDays.forEach(day => {
                const dateStr = format(day.date, 'yyyy-MM-dd');
                const totalPersonnel = filteredRecords
                    .filter(r => r.date === dateStr && r.assistants.some(a => a.assistantName === assistantName))
                    .reduce((sum, record) => {
                        const assistantRecord = record.assistants.find(a => a.assistantName === assistantName);
                        return sum + (assistantRecord?.personnelCount || 0);
                    }, 0);
                row[day.label] = totalPersonnel;
            });
            data.set(assistantName, row);
        });

        return { comparisonDays, data };
    }, [allRecords, filters]);
    
    const handleApplyFilters = () => {
        setFilters(popoverFilters);
        setIsFilterOpen(false);
    };

    const handleClearFilters = () => {
        setPopoverFilters({ campaign: '', labor: '', lote: '' });
        setFilters({ campaign: '', labor: '', lote: '' });
        setIsFilterOpen(false);
    };

    const totals = useMemo(() => {
        const columnTotals: { [dateLabel: string]: number } = {};
        if (comparisonData.data.size > 0) {
            comparisonData.comparisonDays.forEach(day => {
                columnTotals[day.label] = 0;
            });
            comparisonData.data.forEach(row => {
                comparisonData.comparisonDays.forEach(day => {
                    columnTotals[day.label] += row[day.label] || 0;
                });
            });
        }
        return columnTotals;
    }, [comparisonData]);

    return (
        <Card className="mt-6">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                        <CardTitle>Comparativo de Asistentes</CardTitle>
                        <CardDescription>Análisis de personal por asistente en los últimos días de registro.</CardDescription>
                    </div>
                     <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filtros</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                            <div className="grid gap-4">
                               <div className="space-y-2">
                                  <h4 className="font-medium leading-none">Filtros de Comparación</h4>
                               </div>
                               <div className="grid gap-2">
                                    <Label>Campaña</Label>
                                    <Select value={popoverFilters.campaign} onValueChange={(v) => setPopoverFilters(p => ({ ...p, campaign: v === 'all' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                                    <Label>Labor</Label>
                                    <Select value={popoverFilters.labor} onValueChange={(v) => setPopoverFilters(p => ({ ...p, labor: v === 'all' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.labors.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                                    <Label>Lote</Label>
                                    <Select value={popoverFilters.lote} onValueChange={(v) => setPopoverFilters(p => ({ ...p, lote: v === 'all' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                               </div>
                               <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={handleClearFilters}>Limpiar</Button>
                                <Button size="sm" onClick={handleApplyFilters}>Aplicar</Button>
                               </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardHeader>
            <CardContent>
                {comparisonData.data.size > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Asistente</TableHead>
                                    {comparisonData.comparisonDays.map(day => (
                                        <TableHead key={day.label} className="text-center">{day.label}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from(comparisonData.data.entries()).map(([assistantName, dayData]) => (
                                    <TableRow key={assistantName}>
                                        <TableCell className="font-medium">{assistantName}</TableCell>
                                        {comparisonData.comparisonDays.map(day => (
                                            <TableCell key={`${assistantName}-${day.label}`} className="text-center">
                                                {dayData[day.label] > 0 ? dayData[day.label] : ''}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total</TableCell>
                                    {comparisonData.comparisonDays.map(day => (
                                        <TableCell key={`total-${day.label}`} className="text-center font-bold">
                                            {totals[day.label] > 0 ? totals[day.label] : ''}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground p-4">
                        <p>{(!filters.campaign && !filters.labor && !filters.lote) ? "Seleccione al menos un filtro para ver los datos." : "No se encontraron datos para los filtros seleccionados."}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
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
  }, [loadData, refreshParam, selectedDate]); 

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
      <Card>
        <CardContent className="p-2">
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
        </CardContent>
      </Card>
      {isClientSide && <AsistentesComparisonTable allRecords={allRecords} allLotes={lotesMaestro} />}
    </div>
  );
}

// Add a new state to ensure the new table only renders on the client
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

    