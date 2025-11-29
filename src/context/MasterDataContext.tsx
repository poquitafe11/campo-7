
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, getDocs, onSnapshot, getDocsFromCache } from 'firebase/firestore';
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

const collectionsConfig = [
    { name: 'maestro-lotes', key: 'lotes', processor: (doc: any) => ({ id: doc.id, ...doc.data(), fechaCianamida: doc.data().fechaCianamida?.toDate ? doc.data().fechaCianamida.toDate() : (doc.data().fechaCianamida ? parseISO(doc.data().fechaCianamida) : new Date()) }) },
    { name: 'maestro-labores', key: 'labors', processor: (doc: any) => ({ codigo: doc.id, ...doc.data() }) },
    { name: 'asistentes', key: 'asistentes', processor: (doc: any) => ({ id: doc.id, assistantName: doc.data().nombre, cargo: doc.data().cargo, personnelCount: 0, absentCount: 0 }) },
    { name: 'min-max', key: 'minMax', processor: (doc: any) => ({ id: doc.id, ...doc.data() }) },
    { name: 'maestro-jaladores', key: 'jaladores', processor: (doc: any) => ({ id: doc.id, ...doc.data() }) },
    { name: 'maestro-trabajadores', key: 'trabajadores', processor: (doc: any) => ({ dni: doc.id, name: doc.data().name }) },
];

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MasterData>({ lotes: [], labors: [], asistentes: [], minMax: [], jaladores: [], trabajadores: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const loadMasterData = useCallback(async () => {
    console.log('Refreshing master data...');
    setLoading(true);
    try {
        const allDataPromises = collectionsConfig.map(async ({ name, key, processor }) => {
            const querySnapshot = await getDocs(collection(db, name));
            return { key, data: querySnapshot.docs.map(processor) };
        });

        const allDataResults = await Promise.all(allDataPromises);
        const newData: Partial<MasterData> = {};
        allDataResults.forEach(result => {
            (newData as any)[result.key] = result.data;
        });

        setData(currentData => ({ ...currentData, ...newData as MasterData }));

    } catch (err) {
        console.error("Manual refresh failed: ", err);
        toast({
            variant: "destructive",
            title: "Error al Refrescar",
            description: "No se pudieron actualizar los datos maestros.",
        });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // This effect now uses onSnapshot to listen for real-time updates.
    // The `goOffline` and `goOnline` functions in firebase.ts will control
    // whether these listeners actually hit the network. When offline,
    // onSnapshot will only serve cached data.
    setLoading(true);
    const unsubscribes = collectionsConfig.map(({ name, key, processor }) => {
      const q = collection(db, name);
      return onSnapshot(q, (querySnapshot) => {
        const collectionData = querySnapshot.docs.map(processor);
        setData(prevData => ({
          ...prevData,
          [key]: collectionData,
        }));
        setLoading(false);
      }, (err) => {
        console.error(`Error listening to ${name}:`, err);
        setError(new Error(`Failed to listen to ${name}.`));
        setLoading(false);
        toast({
            variant: 'destructive',
            title: `Error de Conexión: ${name}`,
            description: 'No se pudieron sincronizar los datos.',
        });
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
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
