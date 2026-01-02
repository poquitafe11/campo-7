"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfDay, endOfDay, parse, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Calendar as CalendarIcon, RefreshCcw, ArrowLeft, ChevronsRight } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useMasterData } from '@/context/MasterDataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';


type ProjectionRecord = { 
  jabas: number; 
  fecha: Date;
  lote: string;
  cuartel: string;
};
type ShipmentRecord = { 
  id: string; 
  jabas: number; 
  fecha: Date;
  grupo: number;
  lote: string;
  cuartel: string;
  horaEmbarque: string;
  responsable: string;
  viaje: number;
  guia: string;
  [key: string]: any;
};
type Group = {
  id: string;
  numeroGrupo: number;
  asistenteId: string;
  tickeraId: string;
  embarcadorId: string;
};

interface DrilldownState {
  lote: string | null;
  cuartel: string | null;
  fecha: string | null;
  asistente: string | null;
}

export default function ShipmentSummaryPage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [projectedData, setProjectedData] = useState<ProjectionRecord[]>([]);
  const [executedData, setExecutedData] = useState<ShipmentRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState("por-grupo");
  const { asistentes } = useMasterData();
  const [drilldown, setDrilldown] = useState<DrilldownState>({ lote: null, cuartel: null, fecha: null, asistente: null });


  const fetchData = useCallback(() => {
    setLoading(true);
    
    const startOfSelectedDay = startOfDay(selectedDate);
    const endOfSelectedDay = endOfDay(selectedDate);
    
    const projectionsQuery = query(
      collection(db, "proyeccion-embarque"),
      where("fecha", ">=", Timestamp.fromDate(startOfSelectedDay)),
      where("fecha", "<=", Timestamp.fromDate(endOfSelectedDay))
    );

    const shipmentsQuery = query(
      collection(db, "registros-embarque"),
      where("fecha", ">=", Timestamp.fromDate(startOfSelectedDay)),
      where("fecha", "<=", Timestamp.fromDate(endOfSelectedDay))
    );
    
    const groupsQuery = query(collection(db, "grupos-cosecha"));

    const unsubscribeProjections = onSnapshot(projectionsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            return {
                ...docData,
                fecha: docData.fecha?.toDate ? docData.fecha.toDate() : new Date()
            } as ProjectionRecord
        });
        setProjectedData(data);
    }, (error) => {
        console.error("Error fetching projections:", error);
        toast({variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las proyecciones.'});
    });

    const unsubscribeShipments = onSnapshot(shipmentsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            let fecha;
            if (docData.fecha?.toDate) {
              fecha = docData.fecha.toDate();
            } else if (typeof docData.fecha === 'string' && isValid(parseISO(docData.fecha))) {
              fecha = parseISO(docData.fecha);
            } else {
              fecha = new Date();
            }
            return {
                id: doc.id,
                ...docData,
                fecha,
            } as ShipmentRecord
        });
        setExecutedData(data);
    }, (error) => {
        console.error("Error fetching shipments:", error);
        toast({variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los embarques.'});
    });

    const unsubscribeGroups = onSnapshot(groupsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
        setGroups(data);
    }, (error) => {
        console.error("Error fetching groups:", error);
        toast({variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los grupos de cosecha.'});
    });

    const checkLoadingDone = () => {
      const unsub = onSnapshot(shipmentsQuery, () => {
        setLoading(false);
        unsub();
      });
    };
    checkLoadingDone();

    return () => {
      unsubscribeProjections();
      unsubscribeShipments();
      unsubscribeGroups();
    };
  }, [selectedDate, toast]);
  
  useEffect(() => {
    return fetchData();
  }, [fetchData]);
  
   useEffect(() => {
    if (activeTab !== 'por-lote') {
        setDrilldown({ lote: null, cuartel: null, fecha: null, asistente: null });
    }
  }, [activeTab]);


  useEffect(() => {
    setActions({
      title: "Resumen de Embarques",
      right: (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => fetchData()} disabled={loading} className="h-9 w-9">
            <RefreshCcw className="h-5 w-5" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="gap-1 px-2 h-9">
                <CalendarIcon className="h-5 w-5" />
                <span className="text-sm">{format(selectedDate, "d MMM yyyy", { locale: es })}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date || new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )
    });
    return () => setActions({});
  }, [setActions, selectedDate, loading, fetchData]);

  const summaryData = useMemo(() => {
    const totalProjected = projectedData.reduce((sum, item) => sum + item.jabas, 0);
    const totalExecuted = executedData.reduce((sum, item) => sum + item.jabas, 0);
    const percentage = totalProjected > 0 ? (totalExecuted / totalProjected) * 100 : (totalExecuted > 0 ? 100 : 0);

    return {
      totalProjected,
      totalExecuted,
      percentage,
    };
  }, [projectedData, executedData]);

  const summaryByGroup = useMemo(() => {
    if (executedData.length === 0 || groups.length === 0 || asistentes.length === 0) return [];
    
    const grouped = executedData.reduce((acc, record) => {
        const groupNum = record.grupo;
        if (!acc[groupNum]) {
            acc[groupNum] = [];
        }
        acc[groupNum].push(record);
        return acc;
    }, {} as Record<number, ShipmentRecord[]>);
    
    return Object.entries(grouped).map(([groupNum, records]) => {
        const groupInfo = groups.find(g => g.numeroGrupo === parseInt(groupNum, 10));
        const embarcadorName = asistentes.find(a => a.id === groupInfo?.embarcadorId)?.assistantName || 'N/A';
        const totalJabas = records.reduce((sum, r) => sum + r.jabas, 0);
        return {
            groupNum,
            embarcadorName,
            records: records.sort((a,b) => a.viaje - b.viaje),
            totalJabas,
        };
    }).sort((a,b) => parseInt(a.groupNum) - parseInt(b.groupNum));

  }, [executedData, groups, asistentes]);
  
  const drilldownData = useMemo(() => {
    if (!drilldown.lote) { // Level 0: Lote summary
        const projectedByLote = projectedData.reduce((acc, p) => {
            if(!acc[p.lote]) acc[p.lote] = 0;
            acc[p.lote] += p.jabas;
            return acc;
        }, {} as Record<string, number>);

        const executedByLote = executedData.reduce((acc, r) => {
            if(!acc[r.lote]) acc[r.lote] = { ejecutadas: 0, viajes: 0 };
            acc[r.lote].ejecutadas += r.jabas;
            acc[r.lote].viajes += 1;
            return acc;
        }, {} as Record<string, { ejecutadas: number, viajes: number }>);
        
        return Object.keys(executedByLote).map(lote => ({
                lote,
                proyectadas: projectedByLote[lote] || 0,
                ...executedByLote[lote],
                porcentaje: (projectedByLote[lote] || 0) > 0 ? (executedByLote[lote].ejecutadas / projectedByLote[lote]) * 100 : 0,
        })).sort((a,b) => a.lote.localeCompare(b.lote, undefined, { numeric: true }));

    } else if (drilldown.lote && !drilldown.cuartel) { // Level 1: Cuartel summary
        const recordsInLote = executedData.filter(r => r.lote === drilldown.lote);
        const grouped = recordsInLote.reduce((acc, r) => {
            if(!acc[r.cuartel]) acc[r.cuartel] = { jabas: 0, viajes: 0 };
            acc[r.cuartel].jabas += r.jabas;
            acc[r.cuartel].viajes += 1;
            return acc;
        }, {} as Record<string, { jabas: number, viajes: number }>);
        return Object.entries(grouped).map(([cuartel, data]) => ({ cuartel, ...data }));
    
    } else if (drilldown.lote && drilldown.cuartel && !drilldown.fecha) { // Level 2: Fecha summary
        const recordsInCuartel = executedData.filter(r => r.lote === drilldown.lote && r.cuartel === drilldown.cuartel);
        const grouped = recordsInCuartel.reduce((acc, r) => {
            if (!r.fecha || !isValid(r.fecha)) return acc;
            const fechaKey = format(r.fecha, 'yyyy-MM-dd');
            if(!acc[fechaKey]) acc[fechaKey] = { jabas: 0, viajes: 0 };
            acc[fechaKey].jabas += r.jabas;
            acc[fechaKey].viajes += 1;
            return acc;
        }, {} as Record<string, { jabas: number, viajes: number }>);
        return Object.entries(grouped).map(([fecha, data]) => ({ fecha, ...data }));

    } else if (drilldown.lote && drilldown.cuartel && drilldown.fecha && !drilldown.asistente) { // Level 3: Asistente summary
        const recordsOnDate = executedData.filter(r => r.lote === drilldown.lote && r.cuartel === drilldown.cuartel && isValid(r.fecha) && format(r.fecha, 'yyyy-MM-dd') === drilldown.fecha);
        const grouped = recordsOnDate.reduce((acc, r) => {
            if(!acc[r.responsable]) acc[r.responsable] = { jabas: 0, viajes: 0 };
            acc[r.responsable].jabas += r.jabas;
            acc[r.responsable].viajes += 1;
            return acc;
        }, {} as Record<string, { jabas: number, viajes: number }>);
        return Object.entries(grouped).map(([asistenteId, data]) => ({ 
            asistenteId,
            asistenteName: asistentes.find(a => a.id === asistenteId)?.assistantName || asistenteId, 
            ...data 
        }));

    } else if (drilldown.lote && drilldown.cuartel && drilldown.fecha && drilldown.asistente) { // Level 4: Viaje details
        return executedData.filter(r => r.lote === drilldown.lote && r.cuartel === drilldown.cuartel && isValid(r.fecha) && format(r.fecha, 'yyyy-MM-dd') === drilldown.fecha && r.responsable === drilldown.asistente)
                         .sort((a, b) => a.viaje - b.viaje);
    }
    return [];
  }, [drilldown, executedData, projectedData, asistentes]);

  const handleDrilldown = (level: keyof DrilldownState, value: string) => {
    setDrilldown(prev => ({...prev, [level]: value}));
  };

  const handleBreadcrumbClick = (level: keyof DrilldownState | 'root') => {
    if (level === 'root') {
      setDrilldown({ lote: null, cuartel: null, fecha: null, asistente: null });
    } else {
      const newDrilldown: DrilldownState = { lote: null, cuartel: null, fecha: null, asistente: null };
      if (level !== 'lote') newDrilldown.lote = drilldown.lote;
      if (level !== 'cuartel' && level !== 'lote') newDrilldown.cuartel = drilldown.cuartel;
      if (level !== 'fecha' && level !== 'cuartel' && level !== 'lote') newDrilldown.fecha = drilldown.fecha;
      setDrilldown(newDrilldown);
    }
  };

  const renderBreadcrumbs = () => {
    return (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <Button variant="link" className="p-0 h-auto" onClick={() => handleBreadcrumbClick('root')}>Todos los Lotes</Button>
            {drilldown.lote && (
              <>
                <ChevronsRight className="h-4 w-4" />
                <Button variant="link" className="p-0 h-auto" onClick={() => handleBreadcrumbClick('lote')}>Lote {drilldown.lote}</Button>
              </>
            )}
            {drilldown.cuartel && (
              <>
                <ChevronsRight className="h-4 w-4" />
                <Button variant="link" className="p-0 h-auto" onClick={() => handleBreadcrumbClick('cuartel')}>Cuartel {drilldown.cuartel}</Button>
              </>
            )}
            {drilldown.fecha && isValid(parseISO(drilldown.fecha)) && (
              <>
                <ChevronsRight className="h-4 w-4" />
                 <Button variant="link" className="p-0 h-auto" onClick={() => handleBreadcrumbClick('fecha')}>{format(parseISO(drilldown.fecha), "d MMM", { locale: es })}</Button>
              </>
            )}
            {drilldown.asistente && (
              <>
                <ChevronsRight className="h-4 w-4" />
                <span>{asistentes.find(a => a.id === drilldown.asistente)?.assistantName}</span>
              </>
            )}
        </div>
    )
  }

  const renderDrilldownTable = () => {
      if (!drilldown.lote) { // Lote View
          return (
              <Table>
                  <TableHeader><TableRow><TableHead>Lote</TableHead><TableHead className="text-right">Proyectado</TableHead><TableHead className="text-right">Ejecutado</TableHead><TableHead className="text-right">Viajes</TableHead><TableHead className="w-[200px]">Cumplimiento</TableHead></TableRow></TableHeader>
                  <TableBody>{(drilldownData as any[]).map(lote => (<TableRow key={lote.lote} onClick={() => handleDrilldown('lote', lote.lote)} className="cursor-pointer hover:bg-muted/50"><TableCell className="font-medium">{lote.lote}</TableCell><TableCell className="text-right">{lote.proyectadas.toLocaleString('es-PE')}</TableCell><TableCell className="text-right">{lote.ejecutadas.toLocaleString('es-PE')}</TableCell><TableCell className="text-right">{lote.viajes}</TableCell><TableCell><div className="flex items-center gap-2"><Progress value={lote.porcentaje} indicatorClassName={lote.porcentaje >= 95 ? "bg-green-500" : lote.porcentaje >= 80 ? "bg-yellow-500" : "bg-red-500"} className="h-3"/><span className="text-xs font-medium">{lote.porcentaje.toFixed(0)}%</span></div></TableCell></TableRow>))}</TableBody>
              </Table>
          )
      } else if (!drilldown.cuartel) { // Cuartel View
          return (
              <Table>
                  <TableHeader><TableRow><TableHead>Cuartel</TableHead><TableHead className="text-right">Jabas</TableHead><TableHead className="text-right">Viajes</TableHead></TableRow></TableHeader>
                  <TableBody>{(drilldownData as any[]).map(c => (<TableRow key={c.cuartel} onClick={() => handleDrilldown('cuartel', c.cuartel)} className="cursor-pointer hover:bg-muted/50"><TableCell className="font-medium">{c.cuartel}</TableCell><TableCell className="text-right">{c.jabas.toLocaleString('es-PE')}</TableCell><TableCell className="text-right">{c.viajes}</TableCell></TableRow>))}</TableBody>
              </Table>
          )
      } else if (!drilldown.fecha) { // Fecha View
          return (
             <Table>
                  <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead className="text-right">Jabas</TableHead><TableHead className="text-right">Viajes</TableHead></TableRow></TableHeader>
                  <TableBody>{(drilldownData as any[]).map(f => {
                    const date = isValid(parseISO(f.fecha)) ? format(parseISO(f.fecha), "EEEE, d 'de' MMMM", { locale: es }) : 'Fecha inválida';
                    return (
                        <TableRow key={f.fecha} onClick={() => handleDrilldown('fecha', f.fecha)} className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium">{date}</TableCell>
                            <TableCell className="text-right">{f.jabas.toLocaleString('es-PE')}</TableCell>
                            <TableCell className="text-right">{f.viajes}</TableCell>
                        </TableRow>
                    )
                  })}</TableBody>
              </Table>
          )
      } else if (!drilldown.asistente) { // Asistente View
          return (
              <Table>
                  <TableHeader><TableRow><TableHead>Asistente</TableHead><TableHead className="text-right">Jabas</TableHead><TableHead className="text-right">Viajes</TableHead></TableRow></TableHeader>
                  <TableBody>{(drilldownData as any[]).map(a => (<TableRow key={a.asistenteId} onClick={() => handleDrilldown('asistente', a.asistenteId)} className="cursor-pointer hover:bg-muted/50"><TableCell className="font-medium">{a.asistenteName}</TableCell><TableCell className="text-right">{a.jabas.toLocaleString('es-PE')}</TableCell><TableCell className="text-right">{a.viajes}</TableCell></TableRow>))}</TableBody>
              </Table>
          )
      } else { // Viaje View
          return (
              <Table>
                  <TableHeader><TableRow><TableHead>Viaje</TableHead><TableHead>Guía</TableHead><TableHead>Hora</TableHead><TableHead className="text-right">Jabas</TableHead></TableRow></TableHeader>
                  <TableBody>{(drilldownData as any[]).map(v => (<TableRow key={v.id}><TableCell>{v.viaje}</TableCell><TableCell>{v.guia}</TableCell><TableCell>{v.horaEmbarque}</TableCell><TableCell className="text-right">{v.jabas.toLocaleString('es-PE')}</TableCell></TableRow>))}</TableBody>
              </Table>
          )
      }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Cumplimiento de Proyección</CardTitle>
            <CardDescription>Comparación de jabas ejecutadas vs. proyectadas para el {format(selectedDate, "d 'de' MMMM", { locale: es })}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4">
              <div className="relative h-40 w-40">
                  <svg className="h-full w-full" viewBox="0 0 36 36">
                      <path
                          className="text-muted/50"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                      />
                      <path
                          className="text-primary"
                          strokeDasharray={`${summaryData.percentage}, 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                      />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <p className="text-4xl font-bold text-primary">{summaryData.percentage.toFixed(0)}%</p>
                  </div>
              </div>
              <div className="text-center">
                  <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground">{summaryData.totalExecuted.toLocaleString('es-PE')}</span> de <span className="font-semibold text-foreground">{summaryData.totalProjected.toLocaleString('es-PE')}</span> jabas
                  </p>
              </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs defaultValue="por-grupo" className="w-full" onValueChange={setActiveTab}>
         <TabsList className="flex justify-center mb-6 h-auto p-1.5 gap-1.5 rounded-xl bg-muted">
            <TabsTrigger value="por-grupo" className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-colors", activeTab === 'por-grupo' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/50")}>Por Grupo</TabsTrigger>
            <TabsTrigger value="por-lote" className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-colors", activeTab === 'por-lote' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/50")}>Por Lote</TabsTrigger>
            <TabsTrigger value="por-cuartel" className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-colors", activeTab === 'por-cuartel' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/50")}>Por Cuartel</TabsTrigger>
        </TabsList>
         <TabsContent value="por-grupo">
            <div className="space-y-4">
              {summaryByGroup.length > 0 ? summaryByGroup.map(groupData => (
                <div key={groupData.groupNum} className="border-2 border-red-500 text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-red-500 text-white font-bold text-center">
                        <th className="border-r border-white p-1">N° Grupo</th>
                        <th className="border-r border-white p-1">Embarcador</th>
                        <th className="border-r border-white p-1">N° Viaje</th>
                        <th className="border-r border-white p-1">N° Guia</th>
                        <th className="border-r border-white p-1">Cuartel</th>
                        <th className="border-r border-white p-1">Hora Salida</th>
                        <th className="border-r border-white p-1">N° Tractor</th>
                        <th className="border-r border-white p-1">N° Jabas</th>
                        <th className="p-1">Operador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupData.records.map((record, index) => (
                        <tr key={record.id} className="bg-white text-center">
                          {index === 0 && (
                            <>
                              <td rowSpan={groupData.records.length + 1} className="border border-gray-300 font-bold align-middle text-base">{groupData.groupNum}</td>
                              <td rowSpan={groupData.records.length + 1} className="border border-gray-300 font-bold align-middle">{groupData.embarcadorName}</td>
                            </>
                          )}
                          <td className="border-b border-gray-300 px-1 py-0.5">{record.viaje}</td>
                          <td className="border-b border-l border-gray-300 px-1 py-0.5">{record.guia}</td>
                          <td className="border-b border-l border-gray-300 px-1 py-0.5">{record.cuartel}</td>
                          <td className="border-b border-l border-gray-300 px-1 py-0.5">{record.horaEmbarque}</td>
                          <td className="border-b border-l border-gray-300 px-1 py-0.5">{record.tractor}</td>
                          <td className="border-b border-l border-gray-300 px-1 py-0.5">{record.jabas}</td>
                          <td className="border-b border-l border-gray-300 px-1 py-0.5 text-left">{record.operador}</td>
                        </tr>
                      ))}
                      <tr className="bg-white font-bold">
                        <td colSpan={5} className="text-right pr-2"></td>
                        <td colSpan={1} className="text-center border-2 border-black font-bold">{groupData.totalJabas}</td>
                        <td colSpan={1}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )) : (
                 <Card>
                  <CardContent className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">No hay datos de embarque por grupo para este día.</p>
                  </CardContent>
                </Card>
              )}
            </div>
        </TabsContent>
        <TabsContent value="por-lote">
           <Card>
              <CardHeader>
                  <CardTitle>Resumen por Lote</CardTitle>
                  <CardDescription>Análisis interactivo de jabas y viajes por lote.</CardDescription>
              </CardHeader>
              <CardContent>
                  {renderBreadcrumbs()}
                  {drilldownData.length > 0 ? (
                      <div className="overflow-x-auto">
                        {renderDrilldownTable()}
                      </div>
                  ) : (
                       <div className="flex items-center justify-center h-48"><p className="text-muted-foreground">No hay datos por lote para este día.</p></div>
                  )}
              </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="por-cuartel">
            <Card>
                <CardHeader><CardTitle>Resumen por Cuartel</CardTitle></CardHeader>
                <CardContent><div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg"><p className="text-muted-foreground">Contenido en construcción.</p></div></CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
