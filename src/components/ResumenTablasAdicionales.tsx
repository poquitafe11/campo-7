
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
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';

interface ResumenTablasProps {
    allRecords: AttendanceRecord[];
    allLotes: LoteData[];
    selectedDate: Date;
}

const JALADOR_COLUMNS = [
    'EMPRESA', 'CASAVILCA', 'CINTHYA', 'HUARCAYA', 'MIRELLA', 'CHATI', 'MARINA', 
    'DELIA', 'CLERY', 'NOE', 'KARINA', 'ESPERANZA', 'CECILIA', 'ANGELICA', 
    'PASCUAL', 'YOVANA', 'ANA', 'MARIBEL'
];
const ASISTENTE_COLUMN = 'ASISTENTE';

export function ResumenTablasAdicionales({ allRecords, allLotes, selectedDate }: ResumenTablasProps) {
    const { asistentes: assistantsMaster } = useMasterData();

    const recordsForSelectedDate = useMemo(() => {
        if (!selectedDate) return [];
        const selectedDayString = format(startOfDay(selectedDate), 'yyyy-MM-dd');
        return allRecords.filter(r => {
            if (!r.date) return false;
            const recordDayString = format(startOfDay(r.date), 'yyyy-MM-dd');
            return recordDayString === selectedDayString;
        });
    }, [allRecords, selectedDate]);
    
    const resumenPorLote = useMemo(() => {
        const data: { [key: string]: any } = {};
        
        recordsForSelectedDate.forEach(record => {
            const rowKey = `${record.lotName}-${record.labor}`;
            if (!data[rowKey]) {
                const loteData = allLotes.find(l => l.lote === record.lotName);
                const ddc = loteData?.fechaCianamida ? differenceInDays(selectedDate, loteData.fechaCianamida) : 'N/A';

                data[rowKey] = {
                    ddc,
                    lote: record.lotName,
                    codLabor: record.code,
                    labor: record.labor,
                    ...Object.fromEntries(JALADOR_COLUMNS.map(j => [j, 0])),
                    [ASISTENTE_COLUMN]: 0,
                    total: 0,
                };
            }

            (record.assistants || []).forEach(assistant => {
                let assignedToJalador = false;
                
                const assistantPersonnelCount = (assistant.jaladores && assistant.jaladores.length > 0)
                  ? assistant.jaladores.reduce((sum, j) => sum + (j.personnelCount || 0), 0)
                  : (assistant.personnelCount || 0);

                if (assistant.jaladores && assistant.jaladores.length > 0) {
                     assistant.jaladores.forEach(jalador => {
                        const aliasUpper = jalador.jaladorAlias.toUpperCase();
                        if (JALADOR_COLUMNS.includes(aliasUpper)) {
                            data[rowKey][aliasUpper] += jalador.personnelCount;
                            assignedToJalador = true;
                        }
                    });
                }
                
                if (!assignedToJalador) {
                   data[rowKey]['EMPRESA'] += assistantPersonnelCount;
                }

                const isAsistente = assistantsMaster.some(a => a.id === assistant.assistantDni);
                if(isAsistente) {
                    data[rowKey][ASISTENTE_COLUMN] += assistantPersonnelCount;
                }
            });
        });
        
        Object.values(data).forEach(row => {
            row.total = JALADOR_COLUMNS.reduce((sum, j) => sum + (row[j] || 0), 0) + (row[ASISTENTE_COLUMN] || 0);
        });

        const sortedData = Object.values(data).sort((a,b) => a.lote.localeCompare(b.lote, undefined, {numeric: true}) || (a.codLabor || '').localeCompare(b.codLabor || '', undefined, {numeric: true}));
        const columnTotals = {
            ...Object.fromEntries(JALADOR_COLUMNS.map(j => [j, 0])),
            [ASISTENTE_COLUMN]: 0,
            total: 0
        };
        sortedData.forEach(row => {
            JALADOR_COLUMNS.forEach(j => columnTotals[j] += (row[j] || 0));
            columnTotals[ASISTENTE_COLUMN] += (row[ASISTENTE_COLUMN] || 0);
            columnTotals.total += (row.total || 0);
        });


        return { data: sortedData, columnTotals };

    }, [recordsForSelectedDate, allLotes, selectedDate, assistantsMaster]);
    
     const resumenPorLabor = useMemo(() => {
        const data: { [key: string]: any } = {};

        recordsForSelectedDate.forEach(record => {
            const rowKey = record.labor;
            if (!data[rowKey]) {
                data[rowKey] = {
                    codLabor: record.code,
                    labor: record.labor,
                     ...Object.fromEntries(JALADOR_COLUMNS.map(j => [j, 0])),
                    [ASISTENTE_COLUMN]: 0,
                    total: 0,
                };
            }

            (record.assistants || []).forEach(assistant => {
                 let assignedToJalador = false;
                 const assistantPersonnelCount = (assistant.jaladores && assistant.jaladores.length > 0)
                  ? assistant.jaladores.reduce((sum, j) => sum + (j.personnelCount || 0), 0)
                  : (assistant.personnelCount || 0);

                if (assistant.jaladores && assistant.jaladores.length > 0) {
                     assistant.jaladores.forEach(jalador => {
                        const aliasUpper = jalador.jaladorAlias.toUpperCase();
                        if (JALADOR_COLUMNS.includes(aliasUpper)) {
                            data[rowKey][aliasUpper] += jalador.personnelCount;
                            assignedToJalador = true;
                        }
                    });
                }
                
                if (!assignedToJalador) {
                   data[rowKey]['EMPRESA'] += assistantPersonnelCount;
                }
                
                const isAsistente = assistantsMaster.some(a => a.id === assistant.assistantDni);
                 if(isAsistente) {
                    data[rowKey][ASISTENTE_COLUMN] += assistantPersonnelCount;
                }
            });
        });
        
         Object.values(data).forEach(row => {
            row.total = JALADOR_COLUMNS.reduce((sum, j) => sum + (row[j] || 0), 0) + (row[ASISTENTE_COLUMN] || 0);
        });

        const sortedData = Object.values(data).sort((a,b) => (a.codLabor || '').localeCompare(b.codLabor || '', undefined, {numeric: true}));
        const columnTotals = {
            ...Object.fromEntries(JALADOR_COLUMNS.map(j => [j, 0])),
            [ASISTENTE_COLUMN]: 0,
            total: 0
        };
        sortedData.forEach(row => {
            JALADOR_COLUMNS.forEach(j => columnTotals[j] += (row[j] || 0));
            columnTotals[ASISTENTE_COLUMN] += (row[ASISTENTE_COLUMN] || 0);
            columnTotals.total += (row.total || 0);
        });

        return { data: sortedData, columnTotals };

    }, [recordsForSelectedDate, assistantsMaster]);

    const verticalHeaderStyle: React.CSSProperties = {
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        height: '100px',
        textAlign: 'center',
        padding: '2px',
        minWidth: '30px',
        whiteSpace: 'nowrap',
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Resúmenes Adicionales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
                 <div>
                    <h3 className="font-semibold text-lg mb-2">Resumen Por Lote</h3>
                     <div className="border rounded-lg bg-white p-1">
                        <table className="text-xs w-full table-auto">
                           <thead>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200" colSpan={4}></th>
                                    <th className="p-1 border border-black bg-orange-300" colSpan={JALADOR_COLUMNS.length}>JALADORES</th>
                                    <th className="p-1 border border-black bg-red-300" rowSpan={2} style={verticalHeaderStyle}>ASISTENTE</th>
                                    <th className="p-1 border border-black bg-blue-300" rowSpan={2} style={verticalHeaderStyle}>TOTAL</th>
                                </tr>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200">DDC</th>
                                    <th className="p-1 border border-black bg-gray-200">LOTE</th>
                                    <th className="p-1 border border-black bg-gray-200">Cod. Labor</th>
                                    <th className="p-1 border border-black bg-gray-200">LABOR</th>
                                    {JALADOR_COLUMNS.map(j => <th key={j} className="p-1 border border-black bg-orange-200" style={verticalHeaderStyle}>{j}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {resumenPorLote.data.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="p-1 border border-black text-center">{row.ddc}</td>
                                        <td className="p-1 border border-black text-center">{row.lote}</td>
                                        <td className="p-1 border border-black text-center">{row.codLabor}</td>
                                        <td className="p-1 border border-black text-left whitespace-nowrap">{row.labor}</td>
                                        {JALADOR_COLUMNS.map(j => <td key={`${idx}-${j}`} className="p-1 border border-black text-center">{row[j] || ''}</td>)}
                                        <td className="p-1 border border-black text-center">{row[ASISTENTE_COLUMN] || ''}</td>
                                        <td className="p-1 border border-black text-center font-bold">{row.total || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4} className="p-1 border border-black bg-blue-300 font-bold text-center">TOTAL</td>
                                     {JALADOR_COLUMNS.map(j => <td key={`total-${j}`} className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLote.columnTotals[j] || ''}</td>)}
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLote.columnTotals[ASISTENTE_COLUMN] || ''}</td>
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLote.columnTotals.total || ''}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                 <div>
                    <h3 className="font-semibold text-lg mb-2">Resumen Por Labor</h3>
                    <div className="border rounded-lg bg-white p-1">
                       <table className="text-xs w-full table-auto">
                           <thead>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200" colSpan={2}></th>
                                    <th className="p-1 border border-black bg-orange-300" colSpan={JALADOR_COLUMNS.length}>JALADORES</th>
                                    <th className="p-1 border border-black bg-red-300" rowSpan={2} style={verticalHeaderStyle}>ASISTENTE</th>
                                    <th className="p-1 border border-black bg-blue-300" rowSpan={2} style={verticalHeaderStyle}>TOTAL</th>
                                </tr>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200">Cod. Labor</th>
                                    <th className="p-1 border border-black bg-gray-200">LABOR</th>
                                    {JALADOR_COLUMNS.map(j => <th key={j} className="p-1 border border-black bg-orange-200" style={verticalHeaderStyle}>{j}</th>)}
                                </tr>
                            </thead>
                             <tbody>
                                {resumenPorLabor.data.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="p-1 border border-black text-center">{row.codLabor}</td>
                                        <td className="p-1 border border-black text-left whitespace-nowrap">{row.labor}</td>
                                        {JALADOR_COLUMNS.map(j => <td key={`${idx}-${j}`} className="p-1 border border-black text-center">{row[j] || ''}</td>)}
                                        <td className="p-1 border border-black text-center">{row[ASISTENTE_COLUMN] || ''}</td>
                                        <td className="p-1 border border-black text-center font-bold">{row.total || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2} className="p-1 border border-black bg-blue-300 font-bold text-center">TOTAL</td>
                                    {JALADOR_COLUMNS.map(j => <td key={`total-labor-${j}`} className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLabor.columnTotals[j] || ''}</td>)}
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLabor.columnTotals[ASISTENTE_COLUMN] || ''}</td>
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
