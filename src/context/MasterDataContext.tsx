
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LoteData, Labor, Assistant } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { parseISO } from 'date-fns';

interface MasterData {
  lotes: LoteData[];
  labors: Labor[];
  asistentes: Assistant[];
}

interface MasterDataContextType extends MasterData {
  loading: boolean;
  error: Error | null;
  refreshData: () => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MasterData>({ lotes: [], labors: [], asistentes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const loadMasterData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setLoading(true);
    setError(null);
    try {
      const lotesSnapshot = await getDocs(collection(db, 'maestro-lotes'));
      const lotesData = lotesSnapshot.docs.map(doc => {
          const docData = doc.data();
          const fechaCianamida = docData.fechaCianamida?.toDate ? docData.fechaCianamida.toDate() : (docData.fechaCianamida ? parseISO(docData.fechaCianamida) : new Date());
          return { id: doc.id, ...docData, fechaCianamida } as LoteData;
      });

      const laborsSnapshot = await getDocs(collection(db, 'maestro-labores'));
      const laborsData = laborsSnapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() } as Labor));

      const asistentesSnapshot = await getDocs(collection(db, 'asistentes'));
      const asistentesData = asistentesSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          assistantName: doc.data().nombre,
          cargo: doc.data().cargo, 
          personnelCount: 0, 
          absentCount: 0 
      }));

      setData({ lotes: lotesData, labors: laborsData, asistentes: asistentesData });

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
      if (isInitialLoad) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMasterData(true);
  }, [loadMasterData]);

  const value = { ...data, loading, error, refreshData: () => loadMasterData(false) };

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
