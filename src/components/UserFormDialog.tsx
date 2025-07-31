
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
import { UserSchema, UserRole, NewUserSchema } from "@/lib/types";
import { saveUser, createUserInAuth } from "@/app/users/actions";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

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

// Use the base schema without password for the form shape itself
const DialogFormSchema = UserSchema.extend({});

export default function UserFormDialog({ isOpen, onOpenChange, user, onSuccess, currentUserRole }: UserFormDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof DialogFormSchema>>({
    resolver: zodResolver(DialogFormSchema),
    defaultValues: {
      nombre: "",
      dni: "",
      celular: "",
      email: "",
      rol: "Invitado",
      active: true,
      permissions: {},
    },
  });
  
  useEffect(() => {
    if (isOpen) {
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
                permissions: {},
            });
        }
    }
  }, [user, form, isOpen])


  const onSubmit = async (values: z.infer<typeof DialogFormSchema>) => {
    setIsSubmitting(true);
    
    // If it's a new user, create in Auth first using DNI as password
    if (!user) {
        const authResult = await createUserInAuth(values.dni, values.email);
        if (!authResult.success) {
            toast({
                variant: "destructive",
                title: "Error de Autenticación",
                description: authResult.message,
            });
            setIsSubmitting(false);
            return;
        }
    }
    
    // Now save/update the user profile in Firestore
    const dbResult = await saveUser(values);

    if (dbResult.success) {
      toast({
        title: "Éxito",
        description: dbResult.message,
      });
      onSuccess();
    } else {
      toast({
        variant: "destructive",
        title: "Error de Base de Datos",
        description: dbResult.message,
      });
    }
    setIsSubmitting(false);
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
            {user ? "Modifica los datos del usuario." : "La contraseña se asignará automáticamente con el DNI."}
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
