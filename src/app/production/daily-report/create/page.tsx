
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

// Placeholder page for creating a daily report.
// The form for this will be built according to user specifications.
export default function CreateDailyReportPage() {

  return (
    <>
      <PageHeader title="Crear Parte Diario" />
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-background">
        <h3 className="text-xl font-semibold text-muted-foreground">Formulario en Construcción</h3>
        <p className="text-muted-foreground mt-2">
          Este formulario para el parte diario se creará a continuación.
        </p>
      </div>
    </>
  );
}
