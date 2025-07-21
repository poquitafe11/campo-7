
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

// Placeholder page for creating a daily report.
// The form for this will be built according to user specifications.
export default function CreateDailyReportPage() {

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/20">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/production/daily-report">
              <ArrowLeft />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <h1 className="text-xl font-semibold font-headline">Crear Parte Diario</h1>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
           <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-background">
            <h3 className="text-xl font-semibold text-muted-foreground">Formulario en Construcción</h3>
            <p className="text-muted-foreground mt-2">
              Este formulario para el parte diario se creará a continuación.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
