"use client";

import { useState, useEffect, useCallback } from 'react';
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
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';


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

async function updateUserPermissionsClient(email: string, permissions: Record<string, boolean>) {
    try {
        const userRef = doc(db, 'usuarios', email);
        
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            return { success: false, message: "Usuario no encontrado." };
        }
        
        const userData = userDoc.data();
        const updatedPermissions = { ...userData.permissions, ...permissions };

        await updateDoc(userRef, {
            permissions: updatedPermissions
        });
        
        return { success: true, message: "Permisos actualizados." };
    } catch (error) {
        console.error("Error updating user permissions:", error);
        return { success: false, message: "No se pudieron actualizar los permisos." };
    }
}


export default function FeaturePermissionsDialog({ isOpen, onOpenChange, feature, onSuccess }: FeaturePermissionsDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        const allUsers = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as User[];
        
        // Filter out roles higher than or equal to the current admin's role
        const currentUserLevel = profile?.rol ? roleHierarchy[profile.rol] : 0;
        const manageableUsers = allUsers.filter(u => {
            if (u.rol && roleHierarchy[u.rol] !== undefined) {
                return roleHierarchy[u.rol] < currentUserLevel;
            }
            return currentUserLevel > 0; 
        });
        setUsers(manageableUsers);
    } catch (error) {
        console.error("Error fetching users:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los usuarios." });
    } finally {
        setLoading(false);
    }
  }, [toast, profile]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  const handlePermissionChange = async (email: string, hasAccess: boolean) => {
    const permissionsToUpdate = { [feature.href]: hasAccess };
    
    // Optimistically update UI
    setUsers(prev => prev.map(u => u.email === email ? { ...u, permissions: { ...u.permissions, [feature.href]: hasAccess } } : u));

    const result = await updateUserPermissionsClient(email, permissionsToUpdate);

    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.message });
      // Revert UI change on failure
      setUsers(prev => prev.map(u => u.email === email ? { ...u, permissions: { ...u.permissions, [feature.href]: !hasAccess } } : u));
    }
  };

  const groupedUsersByRole = users.reduce((acc, user) => {
    const role = user.rol || 'Invitado';
    (acc[role] = acc[role] || []).push(user);
    return acc;
  }, {} as Record<UserRole, User[]>);
  
  const sortedRoles = (Object.keys(groupedUsersByRole) as UserRole[]).sort((a,b) => roleHierarchy[b] - roleHierarchy[a]);

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
            ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    No tienes usuarios con roles inferiores para gestionar sus permisos.
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
