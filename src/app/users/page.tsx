'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { PlusCircle, Pencil, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/PageHeader';
import { User, UserRole, userSchema, ROLES } from '@/lib/types';
import { getUsers, toggleUserStatus, saveUser } from './actions';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';


export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const { toast } = useToast();

  const form = useForm<User>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      nombre: '',
      dni: '',
      celular: '',
      email: '',
      rol: 'Invitado',
      active: true,
    },
  });

  const fetchAndSetUsers = useCallback(async (role: UserRole) => {
    setLoading(true);
    const fetchedUsers = await getUsers(role);
    setUsers(fetchedUsers);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        // Fetch user profile from 'asistentes' collection
        const userDocRef = doc(db, 'asistentes', user.email); // Assume DNI is used as doc ID and matches email
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const role = userData.cargo as UserRole;
          if (ROLES.includes(role)) {
            setCurrentUserRole(role);
            fetchAndSetUsers(role);
          } else {
            setCurrentUserRole('Invitado');
            setUsers([]);
            setLoading(false);
          }
        } else {
          // Fallback or handle cases where user is not in 'asistentes'
          setCurrentUserRole('Invitado');
          setUsers([]);
          setLoading(false);
        }
      } else {
        setLoading(false);
        setCurrentUserRole(null);
        setUsers([]);
      }
    });

    return () => unsubscribe();
  }, [fetchAndSetUsers]);

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    if (!currentUserRole) return;
    const result = await toggleUserStatus(userId, !currentStatus, currentUserRole);
    if (result.success) {
      toast({ title: 'Éxito', description: 'Estado del usuario actualizado.' });
      fetchAndSetUsers(currentUserRole);
    } else {
      toast({
        title: 'Error',
        description: result.message || 'No se pudo actualizar el estado.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset(user);
    setFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    form.reset({
      nombre: '',
      dni: '',
      celular: '',
      email: '',
      rol: 'Invitado',
      active: true,
    });
    setFormOpen(true);
  };

  const onSubmit = async (values: User) => {
    if (!currentUserRole) return;
    const isEditing = !!editingUser;
    
    // Ensure the ID is set for editing. The action uses email as ID now.
    const submissionData = { ...values, id: editingUser?.id || values.email };

    const result = await saveUser(submissionData, currentUserRole, isEditing);
    if (result.success) {
      toast({ title: 'Éxito', description: result.message });
      setFormOpen(false);
      fetchAndSetUsers(currentUserRole);
    } else {
      toast({
        title: 'Error',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  const availableRolesForCurrentUser = useMemo(() => {
    if (currentUserRole === 'Administrador') return ROLES;
    if (currentUserRole === 'Jefe de Campo') return ['Supervisor', 'Asistente de Campo', 'Invitado'];
    if (currentUserRole === 'Supervisor') return ['Asistente de Campo', 'Invitado'];
    return [];
  }, [currentUserRole]);

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      { accessorKey: 'nombre', header: 'Nombre' },
      { accessorKey: 'dni', header: 'DNI' },
      { accessorKey: 'celular', header: 'Celular' },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'rol', header: 'Rol' },
      {
        accessorKey: 'active',
        header: 'Estado',
        cell: ({ row }) => (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.original.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {row.original.active ? 'Activo' : 'Inactivo'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.active}
              onCheckedChange={() => handleToggleStatus(row.original.id, row.original.active)}
              aria-label="Activar o desactivar usuario"
            />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserRole]
  );

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: { columnFilters },
  });

  const canManageUsers = currentUserRole && ['Administrador', 'Jefe de Campo', 'Supervisor'].includes(currentUserRole);

  if (loading) {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (!currentUserRole) {
     return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <PageHeader title="Gestión de Usuarios" />
            <div className="text-center py-10">
                <p>No has iniciado sesión. Por favor, inicia sesión para gestionar usuarios.</p>
            </div>
        </div>
     );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Gestión de Usuarios" />
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Input
            placeholder="Filtrar por email..."
            value={(table.getColumn('email')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('email')?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
          {canManageUsers && (
            <Button onClick={handleAddNew}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Agregar Usuario
            </Button>
          )}
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
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No se encontraron usuarios.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {/* Pagination component can be added here if needed */}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="nombre" render={({ field }) => ( <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
              <FormField control={form.control} name="dni" render={({ field }) => ( <FormItem><FormLabel>DNI</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
              <FormField control={form.control} name="celular" render={({ field }) => ( <FormItem><FormLabel>Celular</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} disabled={!!editingUser} /></FormControl><FormMessage /></FormItem> )}/>
              <FormField
                control={form.control}
                name="rol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccione un rol" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableRolesForCurrentUser.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Guardar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
