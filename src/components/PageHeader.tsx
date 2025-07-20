"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  const router = useRouter();

  return (
    <header className="flex items-center gap-4 mb-6">
      <Button
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={() => router.back()}
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <h1 className="text-2xl font-bold tracking-tight text-primary">{title}</h1>
    </header>
  );
}
