
"use client";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Settings, LogOut } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

export function Sidebar() {
  const { profile, user, logout } = useAuth();
  const { actions } = useHeaderActions();

  return (
      <header className="sticky top-0 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6 z-30">
        <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
               <SheetHeader className="h-14 flex flex-row items-center border-b px-4">
                  <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src="/icon-7.svg" alt="Campo 7" />
                      <AvatarFallback>C7</AvatarFallback>
                    </Avatar>
                    <span>Campo 7</span>
                  </Link>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                    <SidebarNav />
                </div>
            </SheetContent>
        </Sheet>
        
        <div className="flex w-full items-center justify-end gap-2">
            {actions}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full h-8 w-8">
                  <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.photoURL || ""} />
                      <AvatarFallback>{profile?.nombre.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Toggle user menu</span>
              </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
              <DropdownMenuLabel>{profile?.nombre}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Configuración</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>Cerrar Sesión</DropdownMenuItem>
              </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
  );
}
