
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LoteData, Labor, Assistant, MinMax } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { parseISO } from 'date-fns';

interface MasterData {
  lotes: LoteData[];
  labors: Labor[];
  asistentes: (Assistant & { id: string, assistantName: string, cargo: string })[];
  minMax: MinMax[];
}

interface MasterDataContextType extends MasterData {
  loading: boolean;
  error: Error | null;
  refreshData: () => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MasterData>({ lotes: [], labors: [], asistentes: [], minMax: [] });
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
      
      const minMaxSnapshot = await getDocs(collection(db, 'min-max'));
      const minMaxData = minMaxSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MinMax));

      setData({ lotes: lotesData, labors: laborsData, asistentes: asistentesData, minMax: minMaxData });

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

    const lotesUnsub = onSnapshot(collection(db, 'maestro-lotes'), () => loadMasterData());
    const laboresUnsub = onSnapshot(collection(db, 'maestro-labores'), () => loadMasterData());
    const asistentesUnsub = onSnapshot(collection(db, 'asistentes'), () => loadMasterData());
    const minMaxUnsub = onSnapshot(collection(db, 'min-max'), () => loadMasterData());
    
    return () => {
        lotesUnsub();
        laboresUnsub();
        asistentesUnsub();
        minMaxUnsub();
    }

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
