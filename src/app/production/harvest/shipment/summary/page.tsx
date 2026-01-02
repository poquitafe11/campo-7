
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Calendar as CalendarIcon, RefreshCcw } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { RadialBarChart, RadialBar } from 'recharts';

type ProjectionRecord = { jabas: number; fecha: Timestamp };
type ShipmentRecord = { jabas: number; fecha: Timestamp };

export default function ShipmentSummaryPage() {
  const { setActions } = useHeaderActions();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [projectedData, setProjectedData] = useState<ProjectionRecord[]>([]);
  const [executedData, setExecutedData] = useState<ShipmentRecord[]>([]);

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

    const unsubscribeProjections = onSnapshot(projectionsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as ProjectionRecord);
        setProjectedData(data);
    }, (error) => {
        console.error("Error fetching projections:", error);
        toast({variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las proyecciones.'});
    });

    const unsubscribeShipments = onSnapshot(shipmentsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as ShipmentRecord);
        setExecutedData(data);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching shipments:", error);
        toast({variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los embarques.'});
        setLoading(false);
    });

    return () => {
      unsubscribeProjections();
      unsubscribeShipments();
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

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        </div>
      )}
    </div>
  );
}
