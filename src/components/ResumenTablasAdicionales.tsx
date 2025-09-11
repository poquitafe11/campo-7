"use client";

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type AttendanceRecord, type LoteData, type Labor } from '@/lib/types';
import { useMasterData } from '@/context/MasterDataContext';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';

interface ResumenTablasProps {
    allRecords: AttendanceRecord[];
    allLotes: LoteData[];
    allLabors: Labor[];
    selectedDate: Date;
}

const ASISTENTE_COLUMN = 'ASISTENTE';
const EMPRESA_COLUMN = 'EMPRESA';
const TOTAL_COLUMN = 'TOTAL';

export function ResumenTablasAdicionales({ allRecords, allLotes, allLabors, selectedDate }: ResumenTablasProps) {
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
    
    const jaladorColumns = useMemo(() => {
        const jaladores = new Set<string>();
        recordsForSelectedDate.forEach(record => {
            (record.assistants || []).forEach(assistant => {
                (assistant.jaladores || []).forEach(jalador => {
                    if (jalador.jaladorAlias) {
                       jaladores.add(jalador.jaladorAlias.toUpperCase());
                    }
                });
            });
        });
        
        const uniqueJaladores = Array.from(jaladores).filter(j => j.toUpperCase() !== EMPRESA_COLUMN).sort();
        
        const finalColumns = [EMPRESA_COLUMN, ...uniqueJaladores];
        return finalColumns;

    }, [recordsForSelectedDate]);


    const resumenPorLote = useMemo(() => {
        const data: { [key: string]: any } = {};
        
        recordsForSelectedDate.forEach(record => {
             // Skip "ASISTENTE" labor from appearing as a row
            if (record.code === '903') return;

            (record.assistants || []).forEach(assistant => {
                const processJalador = (jalador: any, targetLabor: string) => {
                     const rowKey = `${record.lotName}-${targetLabor}`;

                     if (!data[rowKey]) {
                         const loteData = allLotes.find(l => l.lote === record.lotName);
                         const ddc = loteData?.fechaCianamida ? differenceInDays(selectedDate, loteData.fechaCianamida) : 'N/A';
                         const targetLaborCode = allLabors.find(l => l.descripcion === targetLabor)?.codigo || record.code;

                        data[rowKey] = {
                            ddc,
                            lote: record.lotName,
                            codLabor: targetLaborCode,
                            labor: targetLabor,
                            ...Object.fromEntries(jaladorColumns.map(j => [j, 0])),
                            [ASISTENTE_COLUMN]: 0,
                            [TOTAL_COLUMN]: 0,
                        };
                    }
                    
                    const aliasUpper = (jalador.jaladorAlias || EMPRESA_COLUMN).toUpperCase();
                    const personnelCount = jalador.personnelCount || 0;
                    
                    if (jaladorColumns.includes(aliasUpper)) {
                        data[rowKey][aliasUpper] = (data[rowKey][aliasUpper] || 0) + personnelCount;
                    }
                };

                // New logic for asistente 903 supporting other labors
                if (record.code !== '903') { // This is a normal labor record
                    const laborAssistants = allRecords
                        .filter(r => r.code === '903' && r.lotName === record.lotName && format(startOfDay(r.date), 'yyyy-MM-dd') === format(startOfDay(selectedDate), 'yyyy-MM-dd'))
                        .flatMap(r => r.assistants);
                    
                    const supportingJaladores = laborAssistants
                        .flatMap(a => a.jaladores || [])
                        .filter(j => j.supportedLabor === record.labor);

                    const allJaladoresForLabor = [...(assistant.jaladores || []), ...supportingJaladores];
                    
                    if (allJaladoresForLabor.length > 0) {
                        allJaladoresForLabor.forEach(j => processJalador(j, record.labor));
                    } else if (assistant.personnelCount) {
                         processJalador({ personnelCount: assistant.personnelCount }, record.labor);
                    }
                }
            });
        });
        
        Object.values(data).forEach(row => {
            const jaladoresTotal = jaladorColumns.reduce((sum, j) => sum + (row[j] || 0), 0);
            row[ASISTENTE_COLUMN] = jaladoresTotal;
            row[TOTAL_COLUMN] = jaladoresTotal;
        });
        
         const sortedData = Object.values(data).sort((a, b) => {
            const isA902 = a.codLabor === '902';
            const isB902 = b.codLabor === '902';

            if (isA902 && !isB902) return -1;
            if (!isA902 && isB902) return 1;

            if (isA902 && isB902) {
                 return a.lote.localeCompare(b.lote, undefined, { numeric: true });
            }
            
            const loteComparison = a.lote.localeCompare(b.lote, undefined, { numeric: true });
            if (loteComparison !== 0) return loteComparison;
            
            const codeA = Number(a.codLabor) || Infinity;
            const codeB = Number(b.codLabor) || Infinity;
            return codeA - codeB;
        });
        
        const columnTotals = {
            ...Object.fromEntries(jaladorColumns.map(j => [j, 0])),
            [ASISTENTE_COLUMN]: 0,
            [TOTAL_COLUMN]: 0
        };
        sortedData.forEach(row => {
            jaladorColumns.forEach(j => columnTotals[j] += (row[j] || 0));
            columnTotals[ASISTENTE_COLUMN] += (row[ASISTENTE_COLUMN] || 0);
            columnTotals[TOTAL_COLUMN] += (row[TOTAL_COLUMN] || 0);
        });


        return { data: sortedData, columnTotals, dynamicJaladores: jaladorColumns };

    }, [recordsForSelectedDate, allLotes, selectedDate, assistantsMaster, jaladorColumns, allLabors, allRecords]);
    
     const resumenPorLabor = useMemo(() => {
        const data: { [key: string]: any } = {};

        recordsForSelectedDate.forEach(record => {
            if (record.code === '903') return;

            (record.assistants || []).forEach(assistant => {
                 const processJalador = (jalador: any, targetLabor: string) => {
                     const rowKey = targetLabor;
                     if (!data[rowKey]) {
                        const targetLaborCode = allLabors.find(l => l.descripcion === targetLabor)?.codigo || record.code;
                        data[rowKey] = {
                            codLabor: targetLaborCode,
                            labor: targetLabor,
                            ...Object.fromEntries(jaladorColumns.map(j => [j, 0])),
                            [ASISTENTE_COLUMN]: 0,
                            [TOTAL_COLUMN]: 0,
                        };
                    }
                     const aliasUpper = (jalador.jaladorAlias || EMPRESA_COLUMN).toUpperCase();
                     const personnelCount = jalador.personnelCount || 0;
                     if (jaladorColumns.includes(aliasUpper)) {
                         data[rowKey][aliasUpper] = (data[rowKey][aliasUpper] || 0) + personnelCount;
                     }
                 };

                  const laborAssistants = allRecords
                    .filter(r => r.code === '903' && format(startOfDay(r.date), 'yyyy-MM-dd') === format(startOfDay(selectedDate), 'yyyy-MM-dd'))
                    .flatMap(r => r.assistants);

                const supportingJaladores = laborAssistants
                    .flatMap(a => a.jaladores || [])
                    .filter(j => j.supportedLabor === record.labor);

                const allJaladoresForLabor = [...(assistant.jaladores || []), ...supportingJaladores];
                
                if (allJaladoresForLabor.length > 0) {
                    allJaladoresForLabor.forEach(j => processJalador(j, record.labor));
                } else if(assistant.personnelCount) {
                    processJalador({ personnelCount: assistant.personnelCount }, record.labor);
                }
            });
        });
        
         Object.values(data).forEach(row => {
            const jaladoresTotal = jaladorColumns.reduce((sum, j) => sum + (row[j] || 0), 0);
            row[ASISTENTE_COLUMN] = jaladoresTotal;
            row[TOTAL_COLUMN] = jaladoresTotal;
        });
        
        const sortedData = Object.values(data).sort((a, b) => {
            const isA902 = a.codLabor === '902';
            const isB902 = b.codLabor === '902';
            if (isA902 !== isB902) return isA902 ? -1 : 1;
             
            const codeA = Number(a.codLabor) || Infinity;
            const codeB = Number(b.codLabor) || Infinity;
            return codeA - codeB;
        });
        
        const columnTotals = {
            ...Object.fromEntries(jaladorColumns.map(j => [j, 0])),
            [ASISTENTE_COLUMN]: 0,
            [TOTAL_COLUMN]: 0
        };
        sortedData.forEach(row => {
            jaladorColumns.forEach(j => columnTotals[j] += (row[j] || 0));
            columnTotals[ASISTENTE_COLUMN] += (row[ASISTENTE_COLUMN] || 0);
            columnTotals[TOTAL_COLUMN] += (row[TOTAL_COLUMN] || 0);
        });

        return { data: sortedData, columnTotals, dynamicJaladores: jaladorColumns };

    }, [recordsForSelectedDate, assistantsMaster, jaladorColumns, allLabors, allRecords, selectedDate]);

    const verticalHeaderStyle: React.CSSProperties = {
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        height: '100px',
        textAlign: 'center',
        padding: '4px 2px',
        minWidth: '24px',
        whiteSpace: 'nowrap',
    };

    if (recordsForSelectedDate.length === 0) {
        return null; // Don't render anything if there's no data for the day
    }

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
                                    <th className="p-1 border border-black bg-orange-300" colSpan={resumenPorLote.dynamicJaladores.length}>JALADORES</th>
                                    <th className="p-1 border border-black bg-red-300" rowSpan={2} style={verticalHeaderStyle}>ASISTENTE</th>
                                    <th className="p-1 border border-black bg-blue-300" rowSpan={2} style={verticalHeaderStyle}>TOTAL</th>
                                </tr>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200">DDC</th>
                                    <th className="p-1 border border-black bg-gray-200">LOTE</th>
                                    <th className="p-1 border border-black bg-gray-200">Cod. Labor</th>
                                    <th className="p-1 border border-black bg-gray-200">LABOR</th>
                                    {resumenPorLote.dynamicJaladores.map(j => <th key={`lote-h-${j}`} className="p-1 border border-black bg-orange-200" style={verticalHeaderStyle}>{j}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {resumenPorLote.data.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="p-1 border border-black text-center">{row.ddc}</td>
                                        <td className="p-1 border border-black text-center">{row.lote}</td>
                                        <td className="p-1 border border-black text-center">{row.codLabor}</td>
                                        <td className="p-1 border border-black text-left whitespace-nowrap">{row.labor}</td>
                                        {resumenPorLote.dynamicJaladores.map(j => <td key={`${idx}-lote-${j}`} className="p-1 border border-black text-center">{row[j] || ''}</td>)}
                                        <td className="p-1 border border-black text-center">{row[ASISTENTE_COLUMN] || ''}</td>
                                        <td className="p-1 border border-black text-center font-bold">{row[TOTAL_COLUMN] || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4} className="p-1 border border-black bg-blue-300 font-bold text-center">TOTAL</td>
                                     {resumenPorLote.dynamicJaladores.map(j => <td key={`total-lote-${j}`} className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLote.columnTotals[j] || ''}</td>)}
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLote.columnTotals[ASISTENTE_COLUMN] || ''}</td>
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLote.columnTotals[TOTAL_COLUMN] || ''}</td>
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
                                    <th className="p-1 border border-black bg-orange-300" colSpan={resumenPorLabor.dynamicJaladores.length}>JALADORES</th>
                                    <th className="p-1 border border-black bg-red-300" rowSpan={2} style={verticalHeaderStyle}>ASISTENTE</th>
                                    <th className="p-1 border border-black bg-blue-300" rowSpan={2} style={verticalHeaderStyle}>TOTAL</th>
                                </tr>
                                <tr>
                                    <th className="p-1 border border-black bg-gray-200">Cod. Labor</th>
                                    <th className="p-1 border border-black bg-gray-200">LABOR</th>
                                    {resumenPorLabor.dynamicJaladores.map(j => <th key={`labor-h-${j}`} className="p-1 border border-black bg-orange-200" style={verticalHeaderStyle}>{j}</th>)}
                                </tr>
                            </thead>
                             <tbody>
                                {resumenPorLabor.data.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="p-1 border border-black text-center">{row.codLabor}</td>
                                        <td className="p-1 border border-black text-left whitespace-nowrap">{row.labor}</td>
                                        {resumenPorLabor.dynamicJaladores.map(j => <td key={`${idx}-labor-${j}`} className="p-1 border border-black text-center">{row[j] || ''}</td>)}
                                        <td className="p-1 border border-black text-center">{row[ASISTENTE_COLUMN] || ''}</td>
                                        <td className="p-1 border border-black text-center font-bold">{row[TOTAL_COLUMN] || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2} className="p-1 border border-black bg-blue-300 font-bold text-center">TOTAL</td>
                                    {resumenPorLabor.dynamicJaladores.map(j => <td key={`total-labor-${j}`} className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLabor.columnTotals[j] || ''}</td>)}
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLabor.columnTotals[ASISTENTE_COLUMN] || ''}</td>
                                    <td className="p-1 border border-black bg-blue-300 font-bold text-center">{resumenPorLabor.columnTotals[TOTAL_COLUMN] || ''}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
