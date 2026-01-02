"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, query, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Calendar as CalendarIcon, RefreshCcw } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { RadialBarChart, RadialBar } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useMasterData } from '@/context/MasterDataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

type ProjectionRecord = { jabas: number; fecha: Timestamp };
type ShipmentRecord = { 
  id: string; 
  jabas: number; 
  fecha: Timestamp;
  grupo: number;
  [key: string]: any;
};
type Group = {
  id: string;
  numeroGrupo: number;
  asistenteId: string;
  tickeraId: string;
  embarcadorId: string;
};


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
        const data = snapshot.docs.map(doc => doc.data() as ProjectionRecord);
        setProjectedData(data);
    }, (error) => {
        console.error("Error fetching projections:", error);
        toast({variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las proyecciones.'});
    });

    const unsubscribeShipments = onSnapshot(shipmentsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShipmentRecord));
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

    // We can set loading to false after the main data (shipments) is fetched
    const checkLoadingDone = () => {
      const unsub = onSnapshot(shipmentsQuery, () => {
        setLoading(false);
        unsub(); // Unsubscribe after first snapshot to avoid multiple triggers
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
    const percentage = totalProjected > 0 ? (totalExecuted / totalProjected) * 100 : 0;

    return {
      totalProjected,
      totalExecuted,
      percentage,
      chartData: [{ name: 'cumplimiento', value: percentage, fill: 'hsl(var(--primary))' }]
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
            <ChartContainer config={{}} className="h-48 w-48">
              <RadialBarChart
                data={summaryData.chartData}
                startAngle={90}
                endAngle={-270}
                innerRadius="70%"
                outerRadius="100%"
                barSize={20}
                cy="55%"
                domain={[0, 100]}
              >
                <RadialBar dataKey="value" background={{ fill: '#e0e0e0' }} cornerRadius={10} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
              </RadialBarChart>
            </ChartContainer>
            <div className="text-center">
              <p className="text-5xl font-bold text-primary">{summaryData.percentage.toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">{summaryData.totalExecuted.toLocaleString('es-PE')}</span> de <span className="font-semibold text-foreground">{summaryData.totalProjected.toLocaleString('es-PE')}</span> jabas
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs defaultValue="por-grupo" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="flex justify-center mb-6 h-auto p-1.5 gap-1.5 rounded-xl bg-muted">
            <TabsTrigger value="por-grupo">Por Grupo</TabsTrigger>
            <TabsTrigger value="por-lote">Por Lote</TabsTrigger>
            <TabsTrigger value="por-cuartel">Por Cuartel</TabsTrigger>
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
                <CardHeader><CardTitle>Resumen por Lote</CardTitle></CardHeader>
                <CardContent><div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg"><p className="text-muted-foreground">Contenido en construcción.</p></div></CardContent>
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
