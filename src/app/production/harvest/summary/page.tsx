
"use client";

import { useEffect, useState } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HarvestSummaryPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Resumen de Cosecha" });
    return () => setActions({});
  }, [setActions]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Tabs defaultValue="registros" className="w-full">
        <div className="flex justify-center">
            <TabsList>
                <TabsTrigger value="registros">Registros</TabsTrigger>
                <TabsTrigger value="por-lote">Por Lote</TabsTrigger>
                <TabsTrigger value="por-cuartel">Por Cuartel</TabsTrigger>
                <TabsTrigger value="por-grupo">Por Grupo</TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="registros" className="mt-6">
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
        <TabsContent value="por-lote" className="mt-6">
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
        <TabsContent value="por-cuartel" className="mt-6">
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
        <TabsContent value="por-grupo" className="mt-6">
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
