"use client";

import { useEffect, useState } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

export default function HarvestSummaryPage() {
  const { setActions } = useHeaderActions();
  const [activeTab, setActiveTab] = useState("registros");

  useEffect(() => {
    setActions({ title: "Resumen de Cosecha" });
    return () => setActions({});
  }, [setActions]);

  const getTriggerClass = (value: string) => cn(
    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
    activeTab === value
      ? "bg-primary/20 text-primary"
      : "text-muted-foreground hover:bg-muted/50"
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Tabs defaultValue="registros" className="w-full" onValueChange={setActiveTab}>
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 rounded-xl bg-muted p-1">
            <TabsTrigger value="registros" className={getTriggerClass("registros")}>Registros</TabsTrigger>
            <TabsTrigger value="por-lote" className={getTriggerClass("por-lote")}>Por Lote</TabsTrigger>
            <TabsTrigger value="por-cuartel" className={getTriggerClass("por-cuartel")}>Por Cuartel</TabsTrigger>
            <TabsTrigger value="por-grupo" className={getTriggerClass("por-grupo")}>Por Grupo</TabsTrigger>
          </div>
        </div>
        <TabsContent value="registros">
            <Card>
                <CardHeader>
                    <CardTitle>Resumen de Registros de Cosecha</CardTitle>
                    <CardDescription>Visualice los datos consolidados de la cosecha.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">Contenido de Registros en construcción.</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="por-lote">
           <Card>
                <CardHeader>
                    <CardTitle>Resumen por Lote</CardTitle>
                    <CardDescription>Análisis de la cosecha agrupado por lote.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">Contenido de Lotes en construcción.</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="por-cuartel">
            <Card>
                <CardHeader>
                    <CardTitle>Resumen por Cuartel</CardTitle>
                    <CardDescription>Análisis de la cosecha agrupado por cuartel.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">Contenido de Cuarteles en construcción.</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="por-grupo">
             <Card>
                <CardHeader>
                    <CardTitle>Resumen por Grupo</CardTitle>
                    <CardDescription>Análisis de la cosecha agrupado por grupo de cosecha.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">Contenido de Grupos en construcción.</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
