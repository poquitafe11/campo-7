
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LoteData, Labor, Assistant, MinMax, Jalador } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { parseISO } from 'date-fns';

interface MasterData {
  lotes: LoteData[];
  labors: Labor[];
  asistentes: (Assistant & { id: string, assistantName: string, cargo: string })[];
  minMax: MinMax[];
  jaladores: Jalador[];
  trabajadores: { dni: string, name: string }[];
}

interface MasterDataContextType extends MasterData {
  loading: boolean;
  error: Error | null;
  refreshData: () => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MasterData>({ lotes: [], labors: [], asistentes: [], minMax: [], jaladores: [], trabajadores: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const loadMasterData = useCallback(async () => {
    // This function can be used to manually trigger a refresh, but the primary loading is handled by onSnapshot.
    console.log('Refreshing master data...');
  }, []);

  useEffect(() => {
    setLoading(true);

    const collections = [
        { name: 'maestro-lotes', key: 'lotes', processor: (doc: any) => ({ id: doc.id, ...doc.data(), fechaCianamida: doc.data().fechaCianamida?.toDate ? doc.data().fechaCianamida.toDate() : (doc.data().fechaCianamida ? parseISO(doc.data().fechaCianamida) : new Date()) }) },
        { name: 'maestro-labores', key: 'labors', processor: (doc: any) => ({ codigo: doc.id, ...doc.data() }) },
        { name: 'asistentes', key: 'asistentes', processor: (doc: any) => ({ id: doc.id, assistantName: doc.data().nombre, cargo: doc.data().cargo, personnelCount: 0, absentCount: 0 }) },
        { name: 'min-max', key: 'minMax', processor: (doc: any) => ({ id: doc.id, ...doc.data() }) },
        { name: 'maestro-jaladores', key: 'jaladores', processor: (doc: any) => ({ id: doc.id, ...doc.data() }) },
        { name: 'maestro-trabajadores', key: 'trabajadores', processor: (doc: any) => ({ dni: doc.id, name: doc.data().name }) },
    ];

    const unsubscribes = collections.map(({ name, key, processor }) => {
        return onSnapshot(collection(db, name), (snapshot) => {
            const collectionData = snapshot.docs.map(processor);
            setData(prevData => ({
                ...prevData,
                [key]: collectionData,
            }));
            setLoading(false); // Set loading to false after the first successful data fetch.
        }, (err) => {
            console.error(`Error loading ${name}:`, err);
            setError(new Error(`Failed to fetch ${name}.`));
            setLoading(false);
            toast({
                variant: 'destructive',
                title: `Error de Carga: ${name}`,
                description: 'No se pudieron cargar los datos maestros. La funcionalidad sin conexión puede verse afectada.',
            });
        });
    });
    
    return () => {
        unsubscribes.forEach(unsub => unsub());
    }

  }, [toast]);

  const value = { ...data, loading, error, refreshData: loadMasterData };

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
