
"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
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
import UserFormDialog from "@/components/UserFormDialog";
import { useAuth } from '@/hooks/useAuth';
import PermissionsDialog from '@/components/PermissionsDialog';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';


export default function UsersPage() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isPermissionsOpen, setPermissionsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { setActions } = useHeaderActions();
  
  const currentUserRole = profile?.rol ?? null;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const usersQuery = collection(db, "usuarios");
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as User[];
        setData(usersData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching users from Firestore: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudieron obtener los usuarios." });
        setLoading(false);
    });

    return unsubscribe;
  }, [toast]);
  
  useEffect(() => {
    setActions({ title: "Gestión de Usuarios" });
    let unsubscribe: () => void;
    if (currentUserRole) {
      fetchUsers().then(unsub => unsubscribe = unsub);
    }
    return () => {
      if (unsubscribe) unsubscribe();
      setActions({});
    }
  }, [currentUserRole, fetchUsers, setActions]);

  const handleDelete = async (email: string) => {
    // Note: Deleting from Firebase Auth requires a backend function, which is not implemented here.
    // This will only delete the user's profile from Firestore.
    try {
      await deleteDoc(doc(db, "usuarios", email));
      toast({ title: "Éxito", description: "Usuario eliminado de la base de datos." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el perfil de usuario." });
    }
  };
  
  const handleStatusChange = async (email: string, active: boolean) => {
    try {
      const userRef = doc(db, "usuarios", email);
      await updateDoc(userRef, { active });
      toast({ title: "Éxito", description: "Estado del usuario actualizado." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado." });
      // Revert UI change on failure
      setData(prev => prev.map(u => u.email === email ? {...u, active: !active} : u));
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormOpen(true);
  };
  
  const handlePermissions = (user: User) => {
    setEditingUser(user);
    setPermissionsOpen(true);
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
                <TableRow key={row.original.email}>{row.getVisibleCells().map((cell) => (
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
