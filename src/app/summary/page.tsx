
"use client";

import { useAppData } from "@/context/AppDataContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductionData, HealthData, IrrigationData, QualityControlData, BiologicalControlData } from "@/lib/types";
import { format } from "date-fns";
import { Sprout, HeartPulse, Droplets, BadgeCheck, Bug } from "lucide-react";

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

  const renderList = <T extends { id: string }>(items: T[], renderItem: (item: T) => React.ReactNode) => {
    if (items.length === 0) {
      return <CardDescription>No data recorded yet.</CardDescription>;
    }
    return <div className="space-y-4">{items.map(item => <div key={item.id} className="p-3 border rounded-md bg-background/50">{renderItem(item)}</div>)}</div>;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Data Summary" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataCard title="Production" icon={<Sprout className="h-5 w-5" />}>
          {renderList(state.production, (item: ProductionData) => (
            <>
              <DataItem label="Crop" value={item.cropType} />
              <DataItem label="Yield (kg)" value={item.yieldAmount} />
              <DataItem label="Planted" value={format(item.plantingDate, 'PPP')} />
              <DataItem label="Harvested" value={format(item.harvestDate, 'PPP')} />
            </>
          ))}
        </DataCard>

        <DataCard title="Health" icon={<HeartPulse className="h-5 w-5" />}>
          {renderList(state.health, (item: HealthData) => (
            <>
              <DataItem label="Date" value={format(item.observationDate, 'PPP')} />
              <DataItem label="Issue" value={item.disease} />
              <DataItem label="Treatment" value={item.treatment} />
              {item.notes && <DataItem label="Notes" value={item.notes} />}
            </>
          ))}
        </DataCard>

        <DataCard title="Irrigation" icon={<Droplets className="h-5 w-5" />}>
          {renderList(state.irrigation, (item: IrrigationData) => (
            <>
              <DataItem label="Date" value={format(item.irrigationDate, 'PPP')} />
              <DataItem label="Water (L)" value={item.waterAmount} />
              <DataItem label="Duration (min)" value={item.durationMinutes} />
            </>
          ))}
        </DataCard>

        <DataCard title="Quality Control" icon={<BadgeCheck className="h-5 w-5" />}>
          {renderList(state.qualityControl, (item: QualityControlData) => (
            <>
              <DataItem label="Date" value={format(item.sampleDate, 'PPP')} />
              <DataItem label="Color" value={item.color} />
              <DataItem label="Brix" value={item.brix} />
              <DataItem label="Firmness" value={`${item.firmness}%`} />
            </>
          ))}
        </DataCard>

        <DataCard title="Biological Control" icon={<Bug className="h-5 w-5" />}>
          {renderList(state.biologicalControl, (item: BiologicalControlData) => (
            <>
              <DataItem label="Date" value={format(item.releaseDate, 'PPP')} />
              <DataItem label="Agent" value={item.agent} />
              <DataItem label="Quantity" value={item.quantity} />
              <DataItem label="Target" value={item.targetPest} />
            </>
          ))}
        </DataCard>
      </div>
    </div>
  );
}
