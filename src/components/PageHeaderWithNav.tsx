
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageHeaderWithNavProps {
  title: string;
  extraActions?: React.ReactNode;
}

export function PageHeaderWithNav({ title, extraActions }: PageHeaderWithNavProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handleBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground ml-2">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {extraActions}
      </div>
    </header>
  );
}
