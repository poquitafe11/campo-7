"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { type User, type UserRole } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getUsers, updateUserPermissions } from '@/app/users/actions';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface FeaturePermissionsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  feature: { title: string, href: string };
  onSuccess: () => void;
}

const roleHierarchy: { [key in UserRole]: number } = {
    "Admin": 4,
    "Jefe": 3,
    "Supervisor": 2,
    "Asistente": 1,
    "Apoyo": 1,
    "Invitado": 0,
};

export default function FeaturePermissionsDialog({ isOpen, onOpenChange, feature, onSuccess }: FeaturePermissionsDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const result = await getUsers();
    if (result.success) {
      // Filter out roles higher than or equal to the current admin's role
      const currentUserLevel = profile?.rol ? roleHierarchy[profile.rol] : 0;
      const manageableUsers = result.data.filter(u => {
          // Robustness check: only filter if both roles are valid and exist in the hierarchy
          if (u.rol && roleHierarchy[u.rol] !== undefined) {
              return roleHierarchy[u.rol] < currentUserLevel;
          }
          // If a user has a missing or invalid role, an admin should still see them to be able to fix it.
          // Or if the current user has no role, show no one.
          return currentUserLevel > 0; 
      });
      setUsers(manageableUsers);
    } else {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los usuarios." });
    }
    setLoading(false);
  }, [toast, profile]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  const handlePermissionChange = async (email: string, hasAccess: boolean) => {
    const permissionsToUpdate = { [feature.href]: hasAccess };
    const result = await updateUserPermissions(email, permissionsToUpdate);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.message });
      // Revert UI change on failure
      setUsers(prev => prev.map(u => u.email === email ? { ...u, permissions: { ...u.permissions, [feature.href]: !hasAccess } } : u));
    } else {
        setUsers(prev => prev.map(u => u.email === email ? { ...u, permissions: { ...u.permissions, [feature.href]: hasAccess } } : u));
    }
  };

  const groupedUsersByRole = users.reduce((acc, user) => {
    (acc[user.rol] = acc[user.rol] || []).push(user);
    return acc;
  }, {} as Record<UserRole, User[]>);
  
  const sortedRoles = Object.keys(groupedUsersByRole).sort((a,b) => roleHierarchy[b as UserRole] - roleHierarchy[a as UserRole]) as UserRole[];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permisos para: {feature.title}</DialogTitle>
          <DialogDescription>
            Activa o desactiva el acceso a esta sección para usuarios específicos.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
            {loading ? (
                <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <Accordion type="multiple" className="w-full">
                    {sortedRoles.map(role => (
                        <AccordionItem value={role} key={role}>
                            <AccordionTrigger>{role}</AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-3">
                                    {groupedUsersByRole[role].map(user => (
                                        <div key={user.email} className="flex items-center justify-between rounded-md border p-3">
                                            <Label htmlFor={`perm-${user.email}`} className="text-sm">
                                                {user.nombre}
                                            </Label>
                                            <Switch
                                                id={`perm-${user.email}`}
                                                checked={user.permissions?.[feature.href] ?? false}
                                                onCheckedChange={(checked) => handlePermissionChange(user.email, checked)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
