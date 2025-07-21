"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
    // State will be cleared by onAuthStateChanged
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Special case for admin user
          if (firebaseUser.email === 'marcoromau@gmail.com') {
            setProfile({
              nombre: 'Marco Romau',
              dni: '12345678',
              celular: '987654321',
              email: 'marcoromau@gmail.com',
              rol: 'Admin',
              active: true,
            });
          } else {
            const userDocRef = doc(db, 'usuarios', firebaseUser.email!);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data() as AppUser;
              if (userData.active) {
                setProfile(userData as AppUser & {rol: UserRole});
              } else {
                // User is not active, treat as logged out
                await signOut(auth); 
                setUser(null);
                setProfile(null);
              }
            } else {
              // No profile found, treat as logged out
              await signOut(auth);
              setUser(null);
              setProfile(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          await signOut(auth);
          setUser(null);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
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
