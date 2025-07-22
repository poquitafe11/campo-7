"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 p-8 border rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold">Bienvenido a Brujos</h1>
        <p className="text-muted-foreground text-center">
          Haz clic en el botón para iniciar sesión y gestionar tu campo.
        </p>
        <Button onClick={() => router.push('/login')} size="lg">
          <LogIn className="mr-2 h-5 w-5" />
          Ir a Iniciar Sesión
        </Button>
      </div>
    </div>
  );
}
