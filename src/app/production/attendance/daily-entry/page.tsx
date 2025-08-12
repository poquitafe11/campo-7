"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AttendanceForm } from '@/components/AttendanceForm';

export default function DailyEntryPage() {
  const router = useRouter();

  return (
    <div>
        <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </div>
            <h1 className="text-lg font-semibold">Registro de Asistencia</h1>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard">
                        <LayoutGrid className="h-5 w-5" />
                    </Link>
                </Button>
            </div>
        </header>

        <main className="p-4">
            <AttendanceForm />
        </main>
    </div>
  );
}
