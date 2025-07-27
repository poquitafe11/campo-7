
"use client";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b -mx-4 sm:-mx-6 px-4 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
    </header>
  );
}
