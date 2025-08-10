

"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, Pencil, Trash2, Loader2, UserX, KeySquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type User, type UserRole } from "@/lib/types";
import { getUsers, updateUserStatus, deleteUser } from "./actions";
import UserFormDialog from "@/components/UserFormDialog";
import { useAuth } from '@/hooks/useAuth';
import PermissionsDialog from '@/components/PermissionsDialog';


export default function UsersPage() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isPermissionsOpen, setPermissionsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const currentUserRole = profile?.rol ?? null;

  const fetchUsers = () => {
    setLoading(true);
    startTransition(async () => {
        const usersResult = await getUsers();
        
        if (usersResult.success) {
            setData(usersResult.data);
        } else if (usersResult.message) {
            if (!usersResult.message.includes("permiso")) {
               toast({ variant: "destructive", title: "Error", description: usersResult.message });
            }
        }
        setLoading(false);
    });
  };
  
  useEffect(() => {
    if (currentUserRole) {
      fetchUsers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserRole]);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormOpen(true);
  };
  
  const handlePermissions = (user: User) => {
    setEditingUser(user);
    setPermissionsOpen(true);
  };

  const handleDelete = async (email: string) => {
    const result = await deleteUser(email);
    if (result.success) {
      toast({ title: "Éxito", description: result.message });
      fetchUsers();
    } else {
      toast({ variant: "destructive", title: "Error", description: result.message });
    }
  };
  
  const handleStatusChange = async (email: string, active: boolean) => {
    const result = await updateUserStatus(email, active);
    if (result.success) {
      toast({ title: "Éxito", description: result.message });
       setData(prev => prev.map(u => u.email === email ? {...u, active} : u));
    } else {
      toast({ variant: "destructive", title: "Error", description: result.message });
    }
  };

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      { accessorKey: "nombre", header: "Nombre" },
      { accessorKey: "dni", header: "DNI" },
      { accessorKey: "celular", header: "Celular" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "rol", header: "Rol" },
      { 
        accessorKey: "active", 
        header: "Estado",
        cell: ({ row }) => (row.original.active ? "Activo" : "Inactivo")
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.active}
              onCheckedChange={(checked) => handleStatusChange(row.original.email, checked)}
              aria-label="Activar/Desactivar usuario"
            />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePermissions(row.original)}>
              <KeySquare className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminará el usuario permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(row.original.email)}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  
  const canManageUsers = useMemo(() => {
    if (!currentUserRole) return false;
    return ["Admin", "Jefe", "Supervisor"].includes(currentUserRole);
  }, [currentUserRole]);


  if (loading || isPending) {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex h-[calc(100vh-10rem)] items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }
  
  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-muted/50">
          <UserX className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Acceso Denegado</h3>
          <p className="mt-1 text-sm text-muted-foreground">No tienes permiso para gestionar usuarios.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditingUser(null); setFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Agregar Usuario
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>{row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}</TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay usuarios para mostrar.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <UserFormDialog
        isOpen={isFormOpen}
        onOpenChange={setFormOpen}
        user={editingUser || undefined}
        onSuccess={() => {
            setFormOpen(false);
            setEditingUser(null);
            fetchUsers();
        }}
        currentUserRole={currentUserRole}
      />
      
      {editingUser && (
        <PermissionsDialog
          isOpen={isPermissionsOpen}
          onOpenChange={setPermissionsOpen}
          user={editingUser}
          onSuccess={() => {
            setPermissionsOpen(false);
            setEditingUser(null);
            fetchUsers();
          }}
        />
      )}
    </>
  );
}
