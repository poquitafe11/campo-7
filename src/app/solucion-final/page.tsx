
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SolucionFinalPage() {
  const projectId = 'brujos';
  const aphaApiUrl = `https://console.cloud.google.com/apis/library/apphosting.googleapis.com?project=${projectId}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Solución Definitiva de Facturación</CardTitle>
          <CardDescription>
            Vamos a activar el servicio necesario manualmente para desbloquear la publicación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold">Paso 1: Confirma tu cuenta</h3>
            <p className="text-sm text-muted-foreground">
              Asegúrate de estar usando la cuenta correcta en la consola de Google Cloud. Deberías estar logueado como:{' '}
              <strong className="text-foreground">marcoromau@gmail.com</strong>.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Paso 2: Activa el servicio de App Hosting</h3>
            <p className="text-sm text-muted-foreground">
              Haz clic en el siguiente botón. Te llevará a la consola de Google Cloud para activar la API de 'App Hosting'. Esto es lo que el diálogo de publicación intenta hacer, pero está fallando.
            </p>
            <Button asChild className="w-full sm:w-auto">
              <a href={aphaApiUrl} target="_blank" rel="noopener noreferrer">
                Activar App Hosting API <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground pt-1">
              Si la página de Google te pide habilitar la API, haz clic en el botón azul que dice "Habilitar". Si ya dice "API Habilitada", entonces no necesitas hacer nada más en esa página.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Paso 3: Vuelve y Publica</h3>
            <p className="text-sm text-muted-foreground">
              Después de habilitar la API, regresa a Firebase Studio, cierra el diálogo de publicación y vuelve a hacer clic en "Publicar". El problema debería estar resuelto.
            </p>
             <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href="/dashboard">
                Volver a la aplicación
              </Link>
            </Button>
          </div>

        </CardContent>
      </Card>
    </main>
  );
}
