
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { type AttendanceRecord, type SummaryData } from '@/lib/types';

import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        Personnel: totals.personnelCount,
        Absentees: totals.absentCount,
      }))
      .reverse(); 

    return { summaryByDate: summary, chartData };
  }, [data]);
  
  const chartConfig = {
      Personnel: { label: 'Personal', color: 'hsl(var(--chart-1))' },
      Absentees: { label: 'Faltos', color: 'hsl(var(--chart-2))' },
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-5rem)] items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/production/attendance">
              <ArrowLeft />
              <span className="sr-only">Volver a Asistencia</span>
            </Link>
          </Button>
          <h1 className="text-lg font-semibold font-headline sm:text-xl">
            Resumen de Asistencia
          </h1>
        </div>
      </header>
       <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <h3 className="text-xl font-semibold">No hay datos de asistencia</h3>
            <p className="text-muted-foreground mt-2">
              Empieza por{' '}
              <Link href="/production/attendance/daily-entry" className="text-primary hover:underline">
                registrar la asistencia
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Tendencia de Asistencia</CardTitle>
                    <CardDescription>Personal vs. Faltos en los últimos registros.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                        <BarChart accessibilityLayer data={chartData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Bar dataKey="Personnel" fill="var(--color-Personnel)" radius={4} />
                            <Bar dataKey="Absentees" fill="var(--color-Absentees)" radius={4} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Resumen por Día</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(summaryByDate).map(([date, totals]) => (
                        <Card key={date}>
                            <CardHeader>
                                <CardTitle className="text-lg">{format(parseISO(date), 'EEEE, dd MMMM yyyy', { locale: es })}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex justify-around text-center">
                                <div>
                                    <p className="text-2xl font-bold">{totals.personnelCount}</p>
                                    <p className="text-sm text-muted-foreground">Personal</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-destructive">{totals.absentCount}</p>
                                    <p className="text-sm text-muted-foreground">Faltos</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
