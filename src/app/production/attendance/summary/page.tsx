
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { type AttendanceRecord, type SummaryData } from '@/lib/types';

import { PageHeaderWithNav } from '@/components/PageHeaderWithNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2 } from 'lucide-react';

export default function AttendanceSummaryPage() {
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'asistencia'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as AttendanceRecord[];
      setData(records);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching attendance data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const { summaryByDate, chartData } = useMemo(() => {
    const summary: Record<string, { personnelCount: number; absentCount: number }> = {};
    
    data.forEach(record => {
      const date = record.date;
      if (!summary[date]) {
        summary[date] = { personnelCount: 0, absentCount: 0 };
      }
      summary[date].personnelCount += record.totals.personnelCount;
      summary[date].absentCount += record.totals.absentCount;
    });

    const chartData: SummaryData[] = Object.entries(summary)
      .map(([date, totals]) => ({
        date: format(parseISO(date), 'dd MMM', { locale: es }),
        dateFull: format(parseISO(date), 'EEEE, dd MMMM yyyy', { locale: es }),
        Personal: totals.personnelCount,
        Faltas: totals.absentCount,
      }))
      .slice(0, 30) // Limit to last 30 days for clarity
      .reverse(); 

    return { summaryByDate: summary, chartData };
  }, [data]);
  
  const chartConfig = {
      Personal: { label: 'Personal', color: 'hsl(var(--chart-1))' },
      Faltas: { label: 'Faltas', color: 'hsl(var(--chart-2))' },
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
       <PageHeaderWithNav title="Resumen de Asistencia" />
       
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/50">
            <h3 className="text-xl font-semibold text-muted-foreground">No hay datos de asistencia</h3>
            <p className="text-muted-foreground mt-2">
              Empieza por{' '}
              <Link href="/production/attendance/daily-entry" className="text-primary hover:underline font-medium">
                registrar la asistencia
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Tendencia de Asistencia (Últimos 30 Días)</CardTitle>
                    <CardDescription>Visualización del personal presente versus las ausencias en los registros más recientes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <BarChart accessibilityLayer data={chartData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                            <YAxis />
                            <ChartTooltip
                                cursor={{ fill: 'hsl(var(--accent))' }}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Bar dataKey="Personal" fill="var(--color-Personal)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Faltas" fill="var(--color-Faltas)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Resumen por Día</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Object.entries(summaryByDate).map(([date, totals]) => (
                        <Card key={date}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-medium">{format(parseISO(date), 'EEEE, dd MMMM', { locale: es })}</CardTitle>
                                <CardDescription>{format(parseISO(date), 'yyyy', { locale: es })}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-around text-center pt-2">
                                <div>
                                    <p className="text-3xl font-bold text-primary">{totals.personnelCount}</p>
                                    <p className="text-sm text-muted-foreground">Personal</p>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-destructive">{totals.absentCount}</p>
                                    <p className="text-sm text-muted-foreground">Faltas</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
          </div>
        )}
    </div>
  );
}
