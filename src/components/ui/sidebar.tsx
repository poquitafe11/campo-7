
"use client";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

export function Sidebar() {
  const { profile, user, logout } = useAuth();

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 flex flex-col">
           <div className="flex items-center h-16 border-b px-4 shrink-0">
             <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/icon-7.svg" alt="Campo 7" />
                  <AvatarFallback>C7</AvatarFallback>
                </Avatar>
                <span>Campo 7</span>
             </Link>
           </div>
           <div className="py-4 flex-1 overflow-y-auto">
             <SidebarNav />
           </div>
           <div className="mt-auto p-4 border-t">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 cursor-pointer">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user?.photoURL || ""} />
                      <AvatarFallback>{profile?.nombre.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{profile?.nombre}</p>
                      <p className="text-xs text-muted-foreground">{profile?.rol}</p>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                 <DropdownMenuContent side="top" align="start" className="w-56">
                    <DropdownMenuLabel>{profile?.nombre}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Configuración</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Cerrar Sesión</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
           </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className={cn("hidden md:block w-64 flex-col border-r bg-background")}>
        <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-16 items-center border-b px-4">
               <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src="/icon-7.svg" alt="Campo 7" />
                        <AvatarFallback>C7</AvatarFallback>
                    </Avatar>
                    <span>Campo 7</span>
               </Link>
            </div>
            <div className="flex-1 overflow-y-auto">
               <SidebarNav />
            </div>
        </div>
      </aside>
    </>
  );
}
