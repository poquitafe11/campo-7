
"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
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

const formatNumber = (num: number, digits = 2) => {
    if (isNaN(num) || !isFinite(num)) {
      return '0.00';
    }
    return num.toLocaleString('es-PE', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
};

export function DetailedSummaryTable({ allActivities, allLotes, allPresupuestos, allMinMax, activeFilters }: DetailedSummaryTableProps) {

    const detailedSummaryData = useMemo(() => {
        if (!activeFilters.lote || allLotes.length === 0) {
            return null;
        }

        const selectedLoteData = allLotes.find(l => l.lote === activeFilters.lote);
        if (!selectedLoteData) return null;
        const variety = selectedLoteData.variedad;

        const varietyLotes = allLotes.filter(l => l.variedad === variety);
        const varietyLoteNumbers = varietyLotes.map(l => l.lote);

        const filteredActivities = allActivities.filter(a =>
            varietyLoteNumbers.includes(a.lote) &&
            (!activeFilters.campaign || a.campaign === activeFilters.campaign) &&
            (!activeFilters.labor || a.labor === activeFilters.labor) &&
            (!activeFilters.pasada || String(a.pass) === activeFilters.pasada)
        );

        if (filteredActivities.length === 0) return null;

        const loteSummaries = varietyLotes.map(loteInfo => {
            const loteActivities = filteredActivities.filter(a => a.lote === loteInfo.lote);
            if (loteActivities.length === 0) return null;

            const haProd = loteInfo.haProd || 0;
            const densidad = loteInfo.densidad || 0;

            const totalPersonnel = loteActivities.reduce((sum, act) => sum + act.personnelCount, 0);
            const totalWorkday = loteActivities.reduce((sum, act) => sum + act.workdayCount, 0);
            const totalPerformance = loteActivities.reduce((sum, act) => sum + (act.performance || 0), 0);

            const jrHa = haProd > 0 ? totalWorkday / haProd : 0;
            const haTrabajada = densidad > 0 ? totalPerformance / densidad : 0;
            const avance = haProd > 0 ? (haTrabajada / haProd) * 100 : 0;
            
            const presupuesto = allPresupuestos.find(p => p.lote === loteInfo.lote && p.descripcionLabor === activeFilters.labor);
            const jrPresup = presupuesto?.jrnHa || 0;
            const saldo = jrPresup - jrHa;

            const minMax = allMinMax.find(mm => mm.lote === loteInfo.lote && mm.labor === activeFilters.labor && String(mm.pasada) === activeFilters.pasada);
            
            const pagoUnitario = loteActivities[0]?.cost || 0; 
            const costoLabor = pagoUnitario > 0 ? totalPerformance * pagoUnitario : totalWorkday * 60;
            const costoHa = haTrabajada > 0 ? costoLabor / haTrabajada : 0;

            return {
                id: loteInfo.id,
                lote: loteInfo.lote,
                ddc: 'N/A', // Placeholder
                haTrabajada: formatNumber(haTrabajada),
                porcAvance: `${formatNumber(avance, 0)}%`,
                saldo: formatNumber(saldo),
                jrHa, // Raw value for color coding
                jrPresup: formatNumber(jrPresup),
                jrEjecutado: formatNumber(jrHa),
                min: minMax?.min ?? 'N/A',
                max: minMax?.max ?? 'N/A',
                costoHa: `S/ ${formatNumber(costoHa)}`,
            };

        }).filter((item): item is NonNullable<typeof item> => item !== null);

        return {
            headers: loteSummaries,
            rows: [
                { label: 'DDC', key: 'ddc' },
                { label: 'Ha. Trabajada', key: 'haTrabajada' },
                { label: '% Avance', key: 'porcAvance' },
                { label: 'Saldo', key: 'saldo' },
                { label: 'Jr/Ha Presup.', key: 'jrPresup' },
                { label: 'Jr/Ha Ejecutado', key: 'jrEjecutado' },
                { label: 'Minimo', key: 'min' },
                { label: 'Maximo', key: 'max' },
                { label: 'Costo/Ha', key: 'costoHa' },
            ]
        };

    }, [allActivities, allLotes, allPresupuestos, allMinMax, activeFilters]);

    if (!detailedSummaryData) {
        return null;
    }

    return (
        <div className="overflow-x-auto pt-6">
            <table className="border-collapse border border-black text-xs table-auto w-full">
                <thead className="text-center font-bold text-black">
                    <tr className="bg-[#ddebf7]">
                        <th className="border border-black p-1 font-bold">LOTE</th>
                        {detailedSummaryData.headers.map(h => (
                            <th key={h.id} className="border border-black p-1 font-bold">{h.lote}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {detailedSummaryData.rows.map(row => (
                         <tr key={row.key}>
                            <td className="border border-black p-1 font-bold bg-[#f2f2f2]">{row.label}</td>
                            {detailedSummaryData.headers.map(h => {
                                const value = (h as any)[row.key];
                                let className = 'border border-black p-1 text-center';
                                if (row.key === 'jrEjecutado') {
                                    const jrEjecutadoNum = h.jrHa;
                                    const min = h.min !== 'N/A' ? h.min : -Infinity;
                                    const max = h.max !== 'N/A' ? h.max : Infinity;
                                    if (jrEjecutadoNum < min) className += ' bg-red-200';
                                    if (jrEjecutadoNum > max) className += ' bg-yellow-200';
                                }

                                return (
                                    <td key={`${h.id}-${row.key}`} className={className}>
                                        {value}
                                    </td>
                                )
                            })}
                         </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
