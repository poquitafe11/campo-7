"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

export function FeatureCard({ icon, title, description, href }: FeatureCardProps) {
  return (
    <Link href={href} className="block group">
      <Card className="h-full transition-all duration-300 ease-in-out group-hover:shadow-lg group-hover:-translate-y-1 group-hover:border-primary">
        <CardHeader>
          <div className="mb-3 text-primary">{icon}</div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="pt-1">{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
