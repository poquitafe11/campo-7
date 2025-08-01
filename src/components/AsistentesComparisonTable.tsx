
"use client";

import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AttendanceRecord, LoteData } from '@/lib/types';


interface AsistenteComparisonFilters {
  campaign: string;
  labor: string;
  lote: string;
}

interface ComparisonDay {
  date: Date;
  label: string;
}

export function AsistentesComparisonTable({ allRecords, allLotes }: { allRecords: AttendanceRecord[], allLotes: LoteData[] }) {
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
