
"use client";

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
    </div>
  );
}
