"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';

export default function SolucionFacturacionPage() {
  const billingUrl = `https://console.cloud.google.com/billing/linkedaccount?project=brujos`;

  return (
    <div className="flex h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Solución al Problema de Facturación</CardTitle>
          <CardDescription>
            Sigue estos pasos para vincular manualmente tu cuenta de facturación existente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            1. Asegúrate de haber iniciado sesión en Google con tu cuenta <strong>marcoromau@gmail.com</strong>.
          </p>
          <p>
            2. Haz clic en el siguiente botón para ir directamente a la página de vinculación de facturación de tu proyecto.
          </p>
          <Button asChild className="w-full">
            <a href={billingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Vincular Cuenta de Facturación
            </a>
          </Button>
           <p className="text-sm text-muted-foreground pt-2">
            Después de vincularla, regresa a Firebase Studio, cierra esta ventana de publicación y haz clic en "Publicar" otra vez. ¡El problema debería estar resuelto!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
