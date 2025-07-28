
"use client";

import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutGrid } from "lucide-react";

interface PageHeaderWithNavProps {
  title: string;
}

export function PageHeaderWithNav({ title }: PageHeaderWithNavProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard">
                    <LayoutGrid className="h-4 w-4" />
                </Link>
            </Button>
        </div>
    </div>
  );
}
