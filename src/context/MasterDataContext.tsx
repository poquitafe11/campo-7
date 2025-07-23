
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
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
      // Create promises for fetching each collection
      const lotesPromise = new Promise<LoteData[]>((resolve, reject) => {
        const unsubscribe = onSnapshot(collection(db, 'maestro-lotes'), (snapshot) => {
          const lotesData = snapshot.docs.map(doc => {
            const docData = doc.data();
            const fechaCianamida = docData.fechaCianamida?.toDate ? docData.fechaCianamida.toDate() : (docData.fechaCianamida ? parseISO(docData.fechaCianamida) : new Date());
            return { id: doc.id, ...docData, fechaCianamida } as LoteData;
          });
          resolve(lotesData);
          unsubscribe();
        }, reject);
      });

      const laborsPromise = new Promise<Labor[]>((resolve, reject) => {
        const unsubscribe = onSnapshot(collection(db, 'maestro-labores'), (snapshot) => {
            const laborsData = snapshot.docs.map(doc => ({ codigo: doc.id, ...doc.data() } as Labor));
            resolve(laborsData);
            unsubscribe();
        }, reject);
      });

      const asistentesPromise = new Promise<Assistant[]>((resolve, reject) => {
        const unsubscribe = onSnapshot(collection(db, 'asistentes'), (snapshot) => {
           const asistentesData = snapshot.docs.map(doc => ({ id: doc.id, assistantName: doc.data().nombre, cargo: doc.data().cargo, personnelCount: 0, absentCount: 0 }));
           resolve(asistentesData);
           unsubscribe();
        }, reject);
      });

      const [lotes, labors, asistentes] = await Promise.all([lotesPromise, laborsPromise, asistentesPromise]);
      setData({ lotes, labors, asistentes });

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
