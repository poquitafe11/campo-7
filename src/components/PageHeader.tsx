
"use client";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-6 pb-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
    </header>
  );
}
