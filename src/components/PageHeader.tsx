
"use client";

import { useAuth } from "@/hooks/useAuth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  const { profile, user } = useAuth();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-primary/5 px-4 sm:px-6 sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-4">
             {profile && (
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.photoURL || ''} alt={profile?.nombre} />
                <AvatarFallback>{profile.nombre ? profile.nombre.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
              </Avatar>
            )}
        </div>
    </header>
  );
}
