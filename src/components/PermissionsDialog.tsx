
"use client";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updateUserPermissions } from "@/app/users/actions";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const permissionsSchema = z.object({
  permissions: z.record(z.boolean()),
});

type PermissionsFormValues = z.infer<typeof permissionsSchema>;

const availablePermissions = [
  { id: '/production', label: 'Producción' },
  { id: '/health', label: 'Sanidad' },
  { id: '/irrigation', label: 'Riego' },
  { id: '/quality-control', label: 'C. Calidad' },
  { id: '/biological-control', label: 'C. Biológico' },
  { id: '/queries', label: 'Consultas' },
  { id: '/summary', label: 'Resumen' },
];

interface PermissionsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
  onSuccess: () => void;
}

export default function PermissionsDialog({ isOpen, onOpenChange, user, onSuccess }: PermissionsDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PermissionsFormValues>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: {
      permissions: {},
    },
  });

  useEffect(() => {
    if (user && isOpen) {
      const userPermissions = availablePermissions.reduce((acc, perm) => {
        acc[perm.id] = user.permissions?.[perm.id] ?? false;
        return acc;
      }, {} as Record<string, boolean>);
      
      form.reset({ permissions: userPermissions });
    }
  }, [user, isOpen, form]);

  const onSubmit = async (values: PermissionsFormValues) => {
    setIsSubmitting(true);
    const result = await updateUserPermissions(user.email, values.permissions);
    if (result.success) {
      toast({
        title: "Éxito",
        description: "Permisos actualizados correctamente.",
      });
      onSuccess();
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.message,
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestionar Permisos para {user.nombre}</DialogTitle>
          <DialogDescription>
            Activa o desactiva el acceso a las diferentes secciones de la aplicación.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {availablePermissions.map((permission) => (
              <Controller
                key={permission.id}
                name={`permissions.${permission.id}`}
                control={form.control}
                render={({ field }) => (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor={permission.id} className="flex-1">
                      {permission.label}
                    </Label>
                    <Switch
                      id={permission.id}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Permisos
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
