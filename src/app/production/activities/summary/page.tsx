
'use client';

import React from 'react';
import { PageHeaderWithNav } from "@/components/PageHeaderWithNav";

const SummaryRow = ({ label, value, labelClasses = "", valueClasses = "" }: { label: string, value: string | number, labelClasses?: string, valueClasses?: string }) => (
    <tr className="bg-[#dbe5f1]">
        <td className={`border border-black px-4 py-2 font-bold ${labelClasses}`}>{label}</td>
        <td className={`border border-black px-4 py-2 text-center ${valueClasses}`}>{value}</td>
    </tr>
);

export default function ActivitySummaryPage() {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <PageHeaderWithNav title="Resumen de Actividades" />
            <div className="flex justify-center">
                <div className="w-full max-w-md">
                    <table className="w-full border-collapse border border-black">
                        <thead>
                            <tr>
                                <th colSpan={2} className="border border-black bg-gray-200 p-2 text-xl font-bold text-center">
                                    PODA PRODUCCIÓN TIMPSON
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <SummaryRow label="Lote" value={78} labelClasses="bg-gray-300" valueClasses="bg-gray-300"/>
                            <SummaryRow label="Pasada" value={1} labelClasses="bg-gray-300 italic" valueClasses="bg-gray-300"/>
                            <SummaryRow label="FECHA" value="21-jul." />
                            <SummaryRow label="N° PERSONAS" value={129} />
                            <SummaryRow label="PLANTAS" value="19,991" />
                            <SummaryRow label="JHU" value="129.00" />
                            <SummaryRow label="PROMEDIO" value={155} />
                            <SummaryRow label="Pltas./ Hora" value={19} labelClasses="bg-[#f8cbad]" valueClasses="bg-[#f8cbad]" />
                            <SummaryRow label="Has." value="12.19" />
                            <SummaryRow label="% Avance" value="86%" />
                            <SummaryRow label="Ha por Trabajar" value="1.99" />
                            <SummaryRow label="MINIMO" value={80} />
                            <SummaryRow label="MAXIMO" value={220} />
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
