
"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function PageHeader({ title }: { title: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between mb-6">
       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
       </Button>
      <h1 className="text-xl font-semibold tracking-tight text-foreground text-center flex-1">
        {title}
      </h1>
      <div className="w-8"></div>
    </div>
  );
}
