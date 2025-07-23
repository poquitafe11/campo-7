
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LoteData, Labor, Assistant } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface MasterDataContextType {
  lotes: LoteData[];
  labors: Labor[];
  asistentes: Assistant[];
  loading: boolean;
  error: Error | null;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [lotes, setLotes] = useState<LoteData[]>([]);
  const [labors, setLabors] = useState<Labor[]>([]);
  const [asistentes, setAsistentes] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadMasterData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [lotesSnapshot, laborsSnapshot, asistentesSnapshot] = await Promise.all([
          getDocs(collection(db, 'maestro-lotes')),
          getDocs(collection(db, 'maestro-labores')),
          getDocs(collection(db, 'asistentes')),
        ]);

        const lotesData = lotesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoteData));
        setLotes(lotesData);

        const laborsData = laborsSnapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() } as Labor));
        setLabors(laborsData);
        
        const asistentesData = asistentesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assistant));
        setAsistentes(asistentesData);

      } catch (err) {
        console.error('Error loading master data:', err);
        const fetchError = new Error('Failed to fetch master data.');
        setError(fetchError);
        toast({
          variant: 'destructive',
          title: 'Error de Carga',
          description: 'No se pudieron cargar los datos maestros. La funcionalidad sin conexión puede verse afectada.',
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadMasterData();
  }, [toast]);

  const value = { lotes, labors, asistentes, loading, error };

  return (
    <MasterDataContext.Provider value={value}>
      {children}
    </MasterDataContext.Provider>
  );
}

export const useMasterData = () => {
  const context = useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
};
