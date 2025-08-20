
"use client";

import { useMemo } from "react";
import { format, parseISO, differenceInDays, isValid } from "date-fns";
import type { ActivityRecordData, LoteData, Presupuesto, MinMax } from "@/lib/types";

interface DetailedSummaryTableProps {
  allActivities: ActivityRecordData[];
  allLotes: LoteData[];
  allPresupuestos: Presupuesto[];
  allMinMax: MinMax[];
  activeFilters: {
    campaign: string;
    lote: string;
    labor: string;
    pasada: string;
  };
}

const formatNumber = (num: number | string | undefined, digits = 2): string => {
    if (num === undefined || num === null || num === '') return '0';
    const number = typeof num === 'string' ? parseFloat(num.replace(',', '.')) : num;
    if (isNaN(number) || !isFinite(number)) {
        return '0';
    }
     if (digits === 0) {
        return Math.round(number).toLocaleString('es-PE');
    }
    return number.toLocaleString('es-PE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

export function DetailedSummaryTable({ allActivities, allLotes, allPresupuestos, allMinMax, activeFilters }: DetailedSummaryTableProps) {

    const detailedSummaryData = useMemo(() => {
        if (!activeFilters.lote || allLotes.length === 0 || !activeFilters.labor) {
            return null;
        }

        const selectedLoteData = allLotes.find(l => l.lote === activeFilters.lote);
        if (!selectedLoteData) return null;
        const variety = selectedLoteData.variedad;

        const varietyLotes = allLotes.filter(l => l.variedad === variety);
        const uniqueLoteNumbers = [...new Set(varietyLotes.map(l => l.lote))].sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));

        const filteredActivities = allActivities.filter(a =>
            (!activeFilters.campaign || a.campaign === activeFilters.campaign) &&
            (!activeFilters.labor || a.labor === activeFilters.labor) &&
            (!activeFilters.pasada || String(a.pass) === activeFilters.pasada)
        );
        
        if (filteredActivities.length === 0) return null;
        
        const loteSummaries = uniqueLoteNumbers.map(loteNum => {
            const lotesDelNumero = allLotes.filter(l => l.lote === loteNum);
            const loteActivities = filteredActivities.filter(a => a.lote === loteNum);
            if (loteActivities.length === 0) return null;

            const haProdTotal = lotesDelNumero.reduce((sum, l) => sum + (l.haProd || 0), 0);
            const densidad = lotesDelNumero[0]?.densidad || 0; // Assume density is the same across a lot

            const totalPerformance = loteActivities.reduce((sum, act) => sum + (act.performance || 0), 0);
            const totalWorkday = loteActivities.reduce((sum, act) => sum + act.workdayCount, 0);

            const haTrabajada = densidad > 0 ? totalPerformance / densidad : 0;
            const haPorTrabajar = haProdTotal - haTrabajada;
            const avance = haProdTotal > 0 ? (haTrabajada / haProdTotal) * 100 : 0;
            
            const jrHa = haTrabajada > 0 ? totalWorkday / haTrabajada : 0;
            
            const prom = totalWorkday > 0 ? totalPerformance / totalWorkday : 0;
            
            const performanceValues = loteActivities.map(a => a.performance || 0).filter(p => p > 0);
            const minimo = performanceValues.length > 0 ? Math.min(...performanceValues) : 0;
            const maximo = performanceValues.length > 0 ? Math.max(...performanceValues) : 0;

            const pltaHora = totalWorkday > 0 ? totalPerformance / (totalWorkday * 8) : 0;

            const costoUnitario = loteActivities[0]?.cost || 0;
            const costoLabor = costoUnitario > 0 ? totalPerformance * costoUnitario : totalWorkday * 60;
            const ingresoPersona = totalWorkday > 0 ? costoLabor / totalWorkday : 0;

            const costoPlta = totalPerformance > 0 ? costoLabor / totalPerformance : 0;

            const firstActivityDate = loteActivities.reduce((earliest, act) => {
                const actDate = act.registerDate instanceof Date ? act.registerDate : parseISO(act.registerDate as any);
                return actDate < earliest ? actDate : earliest;
            }, new Date());
            
            const representativeLoteData = lotesDelNumero[0];
            const ddcInicioLabor = representativeLoteData.fechaCianamida && isValid(representativeLoteData.fechaCianamida) && isValid(firstActivityDate)
                ? differenceInDays(firstActivityDate, representativeLoteData.fechaCianamida)
                : 'N/A';
            
            const ddcHoy = representativeLoteData.fechaCianamida && isValid(representativeLoteData.fechaCianamida) ? differenceInDays(new Date(), representativeLoteData.fechaCianamida) : 'N/A';

            const minMaxEstablecido = allMinMax.find(mm => mm.lote === loteNum && mm.labor === activeFilters.labor && String(mm.pasada) === activeFilters.pasada);
            
            const presupuesto = allPresupuestos.find(p => 
                p.lote === loteNum && 
                p.descripcionLabor.trim().toLowerCase() === activeFilters.labor.trim().toLowerCase() &&
                p.campana === activeFilters.campaign
            );

            const jrnPresup = presupuesto?.jornadas || 0;
            const saldo = jrnPresup - totalWorkday;
            
            return {
                id: loteNum,
                lote: loteNum,
                variedad: variety,
                ddc: ddcHoy,
                haTrabajada: haTrabajada,
                haPorTrabajar: haPorTrabajar,
                porcAvance: avance,
                totalJr: totalWorkday,
                jrHa: jrHa,
                prom: prom,
                minimo: minimo,
                maximo: maximo,
                pltaHora: pltaHora,
                ingresoPersona: ingresoPersona,
                costoPlta: costoPlta,
                pagoPlttaRaci: costoUnitario > 0 ? costoUnitario : 'N/A',
                ddcInicioLabor: ddcInicioLabor,
                minEstablecido: minMaxEstablecido?.min ?? 0,
                maxEstablecido: minMaxEstablecido?.max ?? 0,
                jhPresupHa: presupuesto?.jrnHa ?? 0,
                jrnPresup: jrnPresup,
                jhu: totalWorkday,
                saldo: saldo,
            };

        }).filter((item): item is NonNullable<typeof item> => item !== null);

        if (loteSummaries.length === 0) return null;

        const metrics = [
            { key: 'ddc', label: 'DDC', format: (v: number) => formatNumber(v,0)},
            { key: 'variedad', label: 'Variedad' },
            { key: 'haTrabajada', label: 'Ha Trabajada' },
            { key: 'haPorTrabajar', label: 'Ha por Trabajar' },
            { key: 'porcAvance', label: '% Avance', format: (v: number) => `${formatNumber(v,0)}%` },
            { key: 'totalJr', label: 'Total Jr.' },
            { key: 'jrHa', label: 'Jr/Ha' },
            { key: 'prom', label: 'Prom', format: (v: number) => formatNumber(v,0) },
            { key: 'minimo', label: 'MINIMO', format: (v: number) => formatNumber(v,0) },
            { key: 'maximo', label: 'MAXIMO', format: (v: number) => formatNumber(v,0) },
            { key: 'pltaHora', label: 'Plta. /Hora', format: (v: number) => formatNumber(v,0) },
            { key: 'ingresoPersona', label: 'INGRESO EN S/ persona', format: (v: number) => `S/ ${formatNumber(v)}` },
            { key: 'costoPlta', label: 'Costo Plta' },
            { key: 'pagoPlttaRaci', label: 'Pago pltta/raci', format: (v: any) => typeof v === 'number' ? `S/${formatNumber(v)}` : v },
            { key: 'ddcInicioLabor', label: 'DDC INICIO DE LABOR'},
            { key: 'minEstablecido', label: 'MIN. ESTABLECIDO', format: (v: number) => formatNumber(v,0) },
            { key: 'maxEstablecido', label: 'MAX. ESTABLECIDO', format: (v: number) => formatNumber(v,0) },
            { key: 'jhPresupHa', label: 'JH. Presup/Ha.' },
            { key: 'jrnPresup', label: 'Jrn Presup' },
            { key: 'jhu', label: 'JHU' },
            { key: 'saldo', label: 'saldo' },
        ];

        return {
            headers: loteSummaries,
            rows: metrics,
        };

    }, [allActivities, allLotes, allPresupuestos, allMinMax, activeFilters]);

    if (!detailedSummaryData) {
        return null;
    }

    return (
        <div className="overflow-x-auto pt-6">
            <h3 className="text-lg font-semibold mb-2">Resumen por Lote</h3>
            <table className="border-collapse border border-black text-xs table-auto w-full">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="border border-black p-1 font-bold bg-white">Lote</th>
                        {detailedSummaryData.headers.map(header => (
                            <th key={header.id} className="border border-black p-1 text-center">
                                {header.lote}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {detailedSummaryData.rows.map(row => {
                         let headerBg = '';
                         if (['lote', 'variedad'].includes(row.key)) headerBg = 'bg-gray-200';
                         if (row.key === 'ddc') headerBg = 'bg-green-200';
                         if (['haTrabajada', 'haPorTrabajar', 'porcAvance', 'totalJr', 'jrHa', 'prom', 'minimo', 'maximo', 'pltaHora'].includes(row.key)) headerBg = 'bg-blue-200';
                         if (['ingresoPersona', 'costoPlta', 'pagoPlttaRaci'].includes(row.key)) headerBg = 'bg-orange-200';
                         if (['ddcInicioLabor', 'minEstablecido', 'maxEstablecido'].includes(row.key)) headerBg = 'bg-cyan-200';
                         if (['jhPresupHa', 'jrnPresup', 'jhu', 'saldo'].includes(row.key)) headerBg = 'bg-yellow-200';
                        
                        return (
                            <tr key={row.key}>
                                <td className={`border border-black p-1 font-bold ${headerBg}`}>{row.label}</td>
                                {detailedSummaryData.headers.map(header => {
                                     let cellBg = '';
                                     if(row.key === 'ddc') cellBg = 'bg-green-200';
                                     
                                     const rawValue = (header as any)[row.key];
                                     const displayValue = row.format ? row.format(rawValue) : (typeof rawValue === 'number' ? formatNumber(rawValue, 2) : rawValue);

                                    return (
                                        <td key={`${header.id}-${row.key}`} className={`border border-black p-1 text-center ${cellBg}`}>
                                            {displayValue}
                                        </td>
                                    )
                                })}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
