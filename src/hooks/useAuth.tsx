
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User as AppUser, UserRole } from '@/lib/types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: (AppUser & {rol: UserRole}) | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<(AppUser & {rol: UserRole}) | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  useEffect(() => {
    // Avoid running auth logic on the server
    if (typeof window === 'undefined') {
        return;
    }
      
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        setUser(firebaseUser);
        
        const userDocRef = doc(db, 'usuarios', firebaseUser.email);
        
        const unsubscribeProfile = onSnapshot(userDocRef, (userDocSnap) => {
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as AppUser;
                if (userData.active) {
                    setProfile(userData as AppUser & {rol: UserRole});
                } else {
                    logout();
                }
            } else if (firebaseUser.email === 'marcoromau@gmail.com') {
                 setProfile({
                    nombre: 'Marco Romau',
                    dni: '12345678',
                    celular: '987654321',
                    email: 'marcoromau@gmail.com',
                    rol: 'Admin',
                    active: true,
                    permissions: {} // Admins have all permissions implicitly
                });
            } else {
                logout();
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to user profile:", error);
            logout();
            setLoading(false);
        });

        return () => unsubscribeProfile();

      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [logout]);

  const value = { user, profile, loading, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
