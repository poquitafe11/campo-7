"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { LayoutGrid, Grape, Truck, BarChart3, TrendingUp, FilePlus2, Database, Users } from 'lucide-react';


function HarvestMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <LayoutGrid className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>Registro de Cosecha</DropdownMenuLabel>
        <DropdownMenuGroup>
          <Link href="/production/harvest/register/create">
            <DropdownMenuItem><FilePlus2 className="mr-2 h-4 w-4" />Registro de Cosecha</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/database">
            <DropdownMenuItem><Database className="mr-2 h-4 w-4" />Base de Datos</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/summary">
            <DropdownMenuItem><BarChart3 className="mr-2 h-4 w-4" />Resumen</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/projection">
            <DropdownMenuItem><TrendingUp className="mr-2 h-4 w-4" />Proyección</DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Embarque</DropdownMenuLabel>
         <DropdownMenuGroup>
          <Link href="/production/harvest/shipment/register">
            <DropdownMenuItem><FilePlus2 className="mr-2 h-4 w-4" />Registro</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/shipment/database">
            <DropdownMenuItem><Database className="mr-2 h-4 w-4" />Base de Datos</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/shipment/summary">
            <DropdownMenuItem><BarChart3 className="mr-2 h-4 w-4" />Resumen</DropdownMenuItem>
          </Link>
          <Link href="/production/harvest/shipment/projection">
            <DropdownMenuItem><TrendingUp className="mr-2 h-4 w-4" />Proyección</DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
            <Link href="/production/harvest/groups">
                <DropdownMenuItem>
                    <Users className="mr-2 h-4 w-4" />
                    <span>Gestión de Grupos</span>
                </DropdownMenuItem>
            </Link>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function RegisterShipmentPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ 
        title: "Registro de Embarque",
        right: <HarvestMenu />
    });
    return () => setActions({});
  }, [setActions]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Formulario de Registro de Embarque</CardTitle>
          <CardDescription>Complete los campos para registrar un nuevo embarque.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Formulario en construcción.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
