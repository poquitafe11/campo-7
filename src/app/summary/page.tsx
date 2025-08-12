
"use client";

import { useAppData } from "@/context/AppDataContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductionData, HealthData, IrrigationData, QualityControlData, BiologicalControlData } from "@/lib/types";
import { format } from "date-fns";
import { Sprout, HeartPulse, Droplets, BadgeCheck, Bug } from "lucide-react";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";
import { useEffect } from "react";

const DataCard = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle>
    </CardHeader>
    <CardContent>
      {children}
    </CardContent>
  </Card>
);

const DataItem = ({ label, value }: { label: string, value: string | number | undefined }) => (
  <p><strong className="font-medium text-foreground/80">{label}:</strong> {value}</p>
);

export default function SummaryPage() {
  const { state } = useAppData();
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Resumen" });
    return () => setActions({});
  }, [setActions]);

  const renderList = <T extends { id: string }>(items: T[], renderItem: (item: T) => React.ReactNode) => {
    if (items.length === 0) {
      return <CardDescription>Aún no se han registrado datos.</CardDescription>;
    }
    return <div className="space-y-4">{items.map(item => <div key={item.id} className="p-3 border rounded-md bg-background/50">{renderItem(item)}</div>)}</div>;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataCard title="Producción" icon={<Sprout className="h-5 w-5" />}>
          {renderList(state.production, (item: ProductionData) => (
            <>
              <DataItem label="Cultivo" value={item.cropType} />
              <DataItem label="Rendimiento (kg)" value={item.yieldAmount} />
              <DataItem label="Plantado" value={format(item.plantingDate, 'PPP')} />
              <DataItem label="Cosechado" value={format(item.harvestDate, 'PPP')} />
            </>
          ))}
        </DataCard>

        <DataCard title="Sanidad" icon={<HeartPulse className="h-5 w-5" />}>
          {renderList(state.health, (item: HealthData) => (
            <>
              <DataItem label="Fecha" value={format(item.observationDate, 'PPP')} />
              <DataItem label="Problema" value={item.disease} />
              <DataItem label="Tratamiento" value={item.treatment} />
              {item.notes && <DataItem label="Notas" value={item.notes} />}
            </>
          ))}
        </DataCard>

        <DataCard title="Riego" icon={<Droplets className="h-5 w-5" />}>
          {renderList(state.irrigation, (item: IrrigationData) => (
            <>
              <DataItem label="Fecha" value={format(item.irrigationDate, 'PPP')} />
              <DataItem label="Agua (L)" value={item.waterAmount} />
              <DataItem label="Duración (min)" value={item.durationMinutes} />
            </>
          ))}
        </DataCard>

        <DataCard title="Control de Calidad" icon={<BadgeCheck className="h-5 w-5" />}>
          {renderList(state.qualityControl, (item: QualityControlData) => (
            <>
              <DataItem label="Fecha" value={format(item.sampleDate, 'PPP')} />
              <DataItem label="Color" value={item.color} />
              <DataItem label="Brix" value={item.brix} />
              <DataItem label="Firmeza" value={`${item.firmness}%`} />
            </>
          ))}
        </DataCard>

        <DataCard title="Control Biológico" icon={<Bug className="h-5 w-5" />}>
          {renderList(state.biologicalControl, (item: BiologicalControlData) => (
            <>
              <DataItem label="Fecha" value={format(item.releaseDate, 'PPP')} />
              <DataItem label="Agente" value={item.agent} />
              <DataItem label="Cantidad" value={item.quantity} />
              <DataItem label="Objetivo" value={item.targetPest} />
            </>
          ))}
        </DataCard>
      </div>
    </div>
  );
}
