"use client";

import { useEffect } from 'react';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { AttendanceForm } from '@/components/AttendanceForm';

export default function DailyEntryPage() {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Registro de Asistencia" });
    return () => setActions({});
  }, [setActions]);


  return (
    <div className="p-4">
        <AttendanceForm />
    </div>
  );
}
