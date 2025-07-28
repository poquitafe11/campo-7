
"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function PageHeader({ title }: { title: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="icon" asChild>
           <Link href="/dashboard">
            <LayoutGrid className="h-5 w-5" />
           </Link>
        </Button>
      </div>
    </div>
  );
}
