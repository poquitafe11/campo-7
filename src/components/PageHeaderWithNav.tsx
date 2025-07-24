
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PageHeaderWithNavProps {
  title: string;
  extraButton?: React.ReactNode;
}

export function PageHeaderWithNav({ title, extraButton }: PageHeaderWithNavProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b">
      <div className="flex items-center gap-2">
        {extraButton && (
           <TooltipProvider>
              <Tooltip>
                  <TooltipTrigger asChild>
                      {extraButton}
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Actualizar Datos</p>
                  </TooltipContent>
              </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Volver</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
        <h1 className="text-2xl font-bold tracking-tight text-foreground ml-2">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/dashboard">
                           <LayoutGrid className="h-4 w-4" />
                        </Link>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Menú Principal</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}
