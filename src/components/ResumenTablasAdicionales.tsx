
"use client";

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';
import { type AttendanceRecord, type LoteData } from '@/lib/types';
import { useMasterData } from '@/context/MasterDataContext';
import { format, parseISO, differenceInDays } from 'date-fns';

interface ResumenTablasProps {
    allRecords: AttendanceRecord[];
    allLotes: LoteData[];
    selectedDate: Date;
}

export function ResumenTablasAdicionales({ allRecords, allLotes, selectedDate }: ResumenTablasProps) {
    const { jaladores: jaladoresMaster } = useMasterData();
    const [filters, setFilters] = useState({ campaign: '', lote: '' });
    const [popoverFilters, setPopoverFilters] = useState({ campaign: '', lote: '' });

    const filterOptions = useMemo(() => {
        const campaigns = [...new Set(allRecords.map(r => r.campana).filter(Boolean))].sort();
        const lotes = [...new Set(allRecords.map(r => r.lotName).filter(Boolean))].sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
        return { campaigns, lotes };
    }, [allRecords]);
    
    const handleApplyFilters = () => {
        setFilters(popoverFilters);
    };

    const handleClearFilters = () => {
        setPopoverFilters({ campaign: '', lote: '' });
        setFilters({ campaign: '', lote: '' });
    };
    
    const resumenPorLote = useMemo(() => {
        const data: { [key: string]: any } = {};
        const jaladorColumns = [...new Set(jaladoresMaster.map(j => j.alias))].sort();
        
        allRecords.forEach(record => {
            const campanaMatch = !filters.campaign || record.campana === filters.campaign;
            if (!campanaMatch) return;
            
            const rowKey = `${record.lotName}-${record.labor}`;
            if (!data[rowKey]) {
                const loteData = allLotes.find(l => l.lote === record.lotName);
                const ddc = loteData?.fechaCianamida ? differenceInDays(selectedDate, loteData.fechaCianamida) : 'N/A';

                data[rowKey] = {
                    ddc,
                    lote: record.lotName,
                    codLabor: record.code,
                    labor: record.labor,
                    ...Object.fromEntries(jaladorColumns.map(j => [j, 0])),
                    asistente: 0,
                    total: 0,
                };
            }

            record.assistants.forEach(assistant => {
                if (assistant.jaladores && assistant.jaladores.length > 0) {
                     assistant.jaladores.forEach(jalador => {
                        if (jaladorColumns.includes(jalador.jaladorAlias)) {
                            data[rowKey][jalador.jaladorAlias] += jalador.personnelCount;
                        }
                    });
                } else {
                    data[rowKey]['EMPRESA'] = (data[rowKey]['EMPRESA'] || 0) + (assistant.personnelCount || 0);
                }
                const isAsistente = assistantsMaster.some(a => a.id === assistant.assistantDni);
                if(isAsistente) {
                    data[rowKey].asistente += assistant.personnelCount || 0;
                }
            });
        });
        
        Object.values(data).forEach(row => {
            row.total = jaladorColumns.reduce((sum, j) => sum + row[j], 0) + row.asistente;
        });

        const sortedData = Object.values(data).sort((a,b) => a.lote.localeCompare(b.lote, undefined, {numeric: true}) || a.codLabor.localeCompare(b.codLabor, undefined, {numeric: true}));
        const columnTotals = {
            ...Object.fromEntries(jaladorColumns.map(j => [j, 0])),
            asistente: 0,
            total: 0
        };
        sortedData.forEach(row => {
            jaladorColumns.forEach(j => columnTotals[j] += row[j]);
            columnTotals.asistente += row.asistente;
            columnTotals.total += row.total;
        });


        return { data: sortedData, jaladorColumns, columnTotals };

    }, [allRecords, jaladoresMaster, allLotes, filters, selectedDate]);
    
     const resumenPorLabor = useMemo(() => {
        const data: { [key: string]: any } = {};
        const jaladorColumns = [...new Set(jaladoresMaster.map(j => j.alias))].sort();

        allRecords.forEach(record => {
             const campanaMatch = !filters.campaign || record.campana === filters.campaign;
             const loteMatch = !filters.lote || record.lotName === filters.lote;
             if (!campanaMatch || !loteMatch) return;

            const rowKey = record.labor;
            if (!data[rowKey]) {
                data[rowKey] = {
                    codLabor: record.code,
                    labor: record.labor,
                     ...Object.fromEntries(jaladorColumns.map(j => [j, 0])),
                    asistente: 0,
                    total: 0,
                };
            }

            record.assistants.forEach(assistant => {
                if (assistant.jaladores && assistant.jaladores.length > 0) {
                     assistant.jaladores.forEach(jalador => {
                        if (jaladorColumns.includes(jalador.jaladorAlias)) {
                            data[rowKey][jalador.jaladorAlias] += jalador.personnelCount;
                        }
                    });
                } else {
                     data[rowKey]['EMPRESA'] = (data[rowKey]['EMPRESA'] || 0) + (assistant.personnelCount || 0);
                }
                const isAsistente = assistantsMaster.some(a => a.id === assistant.assistantDni);
                 if(isAsistente) {
                    data[rowKey].asistente += assistant.personnelCount || 0;
                }
            });
        });
        
         Object.values(data).forEach(row => {
            row.total = jaladorColumns.reduce((sum, j) => sum + row[j], 0) + row.asistente;
        });

        const sortedData = Object.values(data).sort((a,b) => a.codLabor.localeCompare(b.codLabor, undefined, {numeric: true}));
        const columnTotals = {
            ...Object.fromEntries(jaladorColumns.map(j => [j, 0])),
            asistente: 0,
            total: 0
        };
        sortedData.forEach(row => {
            jaladorColumns.forEach(j => columnTotals[j] += row[j]);
            columnTotals.asistente += row.asistente;
            columnTotals.total += row.total;
        });

        return { data: sortedData, jaladorColumns, columnTotals };

    }, [allRecords, jaladoresMaster, assistantsMaster, filters]);

    const assistantsMaster = useMasterData().asistentes;

    return (
        <Card className="mt-6">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Resúmenes Adicionales</CardTitle>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline"><Filter className="mr-2 h-4 w-4" />Filtros</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                             <div className="grid gap-4">
                               <div className="space-y-2">
                                  <h4 className="font-medium leading-none">Filtros (Tablas Adicionales)</h4>
                               </div>
                               <div className="grid gap-2">
                                    <Label>Campaña</Label>
                                    <Select value={popoverFilters.campaign} onValueChange={(v) => setPopoverFilters(p => ({ ...p, campaign: v === 'all' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
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
            <CardContent className="space-y-8">
                 <div>
                    <h3 className="font-semibold text-lg mb-2">Resumen Por Lote</h3>
                     <div className="overflow-x-auto border rounded-lg bg-white p-1">
                        <table className="text-xs w-full">
                           <thead>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200" colSpan={4}></th>
                                    <th className="p-1 border border-black bg-orange-300" colSpan={resumenPorLote.jaladorColumns.length + 1}>JALADORES</th>
                                    <th className="p-1 border border-black bg-blue-300" rowSpan={2}>TOTAL</th>
                                </tr>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200">DDC</th>
                                    <th className="p-1 border border-black bg-gray-200">LOTE</th>
                                    <th className="p-1 border border-black bg-gray-200">Cod. Labor</th>
                                    <th className="p-1 border border-black bg-gray-200">LABOR</th>
                                    {resumenPorLote.jaladorColumns.map(j => <th key={j} className="p-1 border border-black bg-orange-200">{j}</th>)}
                                    <th className="p-1 border border-black bg-red-300">ASISTENTE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resumenPorLote.data.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="p-1 border border-black text-center">{row.ddc}</td>
                                        <td className="p-1 border border-black text-center">{row.lote}</td>
                                        <td className="p-1 border border-black text-center">{row.codLabor}</td>
                                        <td className="p-1 border border-black text-left">{row.labor}</td>
                                        {resumenPorLote.jaladorColumns.map(j => <td key={`${idx}-${j}`} className="p-1 border border-black text-center">{row[j] || ''}</td>)}
                                        <td className="p-1 border border-black text-center">{row.asistente || ''}</td>
                                        <td className="p-1 border border-black text-center font-bold">{row.total || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4} className="p-1 border border-black bg-blue-300 font-bold text-center">TOTAL</td>
                                     {resumenPorLote.jaladorColumns.map(j => <td key={`total-${j}`} className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLote.columnTotals[j] || ''}</td>)}
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLote.columnTotals.asistente || ''}</td>
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLote.columnTotals.total || ''}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                 <div>
                    <h3 className="font-semibold text-lg mb-2">Resumen Por Labor</h3>
                    <div className="overflow-x-auto border rounded-lg bg-white p-1">
                       <table className="text-xs w-full">
                           <thead>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200" colSpan={2}></th>
                                    <th className="p-1 border border-black bg-orange-300" colSpan={resumenPorLabor.jaladorColumns.length + 1}>JALADORES</th>
                                    <th className="p-1 border border-black bg-blue-300" rowSpan={2}>TOTAL</th>
                                </tr>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200">Cod. Labor</th>
                                    <th className="p-1 border border-black bg-gray-200">LABOR</th>
                                    {resumenPorLabor.jaladorColumns.map(j => <th key={j} className="p-1 border border-black bg-orange-200">{j}</th>)}
                                    <th className="p-1 border border-black bg-red-300">ASISTENTE</th>
                                </tr>
                            </thead>
                             <tbody>
                                {resumenPorLabor.data.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="p-1 border border-black text-center">{row.codLabor}</td>
                                        <td className="p-1 border border-black text-left">{row.labor}</td>
                                        {resumenPorLabor.jaladorColumns.map(j => <td key={`${idx}-${j}`} className="p-1 border border-black text-center">{row[j] || ''}</td>)}
                                        <td className="p-1 border border-black text-center">{row.asistente || ''}</td>
                                        <td className="p-1 border border-black text-center font-bold">{row.total || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2} className="p-1 border border-black bg-blue-300 font-bold text-center">TOTAL</td>
                                    {resumenPorLabor.jaladorColumns.map(j => <td key={`total-labor-${j}`} className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLabor.columnTotals[j] || ''}</td>)}
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLabor.columnTotals.asistente || ''}</td>
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLabor.columnTotals.total || ''}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

