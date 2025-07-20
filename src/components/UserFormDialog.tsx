
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserSchema, UserRole } from "@/lib/types";
import { saveUser } from "@/app/users/actions";
import { useEffect, useMemo } from "react";

interface UserFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user?: z.infer<typeof UserSchema>;
  onSuccess: () => void;
  currentUserRole: UserRole | null;
}

const roleHierarchy: { [key in UserRole]: number } = {
    "Admin": 4,
    "Jefe": 3,
    "Supervisor": 2,
    "Asistente": 1,
    "Apoyo": 1,
    "Invitado": 0,
};

export default function UserFormDialog({ isOpen, onOpenChange, user, onSuccess, currentUserRole }: UserFormDialogProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof UserSchema>>({
    resolver: zodResolver(UserSchema),
    defaultValues: {
      nombre: "",
      dni: "",
      celular: "",
      email: "",
      rol: "Invitado",
      active: true,
    },
  });
  
  useEffect(() => {
    if (user) {
        form.reset(user);
    } else {
        form.reset({
            nombre: "",
            dni: "",
            celular: "",
            email: "",
            rol: "Invitado",
            active: true,
        });
    }
  }, [user, form, isOpen])


  const onSubmit = async (values: z.infer<typeof UserSchema>) => {
    const result = await saveUser(values);
    if (result.success) {
      toast({
        title: "Éxito",
        description: result.message,
      });
      onSuccess();
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.message,
      });
    }
  };
  
  const availableRoles = useMemo(() => {
    if (!currentUserRole) return [];
    const currentUserLevel = roleHierarchy[currentUserRole];
    return UserRole.options.filter(role => currentUserLevel > roleHierarchy[role]);
  }, [currentUserRole]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{user ? "Editar Usuario" : "Agregar Nuevo Usuario"}</DialogTitle>
          <DialogDescription>
            Completa los datos para registrar un nuevo usuario en el sistema.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Juan Pérez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dni"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DNI</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 12345678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="celular"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Celular</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 987654321" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="ejemplo@correo.com" {...field} disabled={!!user} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="rol"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Seleccione un rol" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {availableRoles.map((role) => (
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
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
