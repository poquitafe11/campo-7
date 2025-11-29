
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
    setLoading(true);

    const setupListeners = async () => {
      // First, try to load everything from cache to get a fast initial load.
      try {
        const allCachePromises = collectionsConfig.map(async ({ name, key, processor }) => {
          const querySnapshot = await getDocsFromCache(collection(db, name));
          return { key, data: querySnapshot.docs.map(processor) };
        });
        const allCacheResults = await Promise.all(allCachePromises);
        const initialData: Partial<MasterData> = {};
        allCacheResults.forEach(result => {
          (initialData as any)[result.key] = result.data;
        });
        setData(currentData => ({ ...currentData, ...initialData as MasterData }));
      } catch (e) {
        console.log("Cache miss or error, will rely on server listeners.", e);
      } finally {
        // Even if cache fails, we must stop loading to show UI,
        // which will then be populated by the realtime listeners.
        setLoading(false);
      }
      
      // Then, set up realtime listeners to keep data fresh.
      const unsubscribes = collectionsConfig.map(({ name, key, processor }) => {
          return onSnapshot(collection(db, name), (snapshot) => {
              const collectionData = snapshot.docs.map(processor);
              setData(prevData => ({
                  ...prevData,
                  [key]: collectionData,
              }));
              // In case the initial cache load was empty, this will now show data.
              if (loading) setLoading(false);
          }, (err) => {
              console.error(`Error listening to ${name}:`, err);
              setError(new Error(`Failed to listen to ${name}.`));
              // Don't set loading to false on error if we already have some data
              if (data[key as keyof MasterData].length === 0) {
                 setLoading(false);
              }
              toast({
                  variant: 'destructive',
                  title: `Error de Conexión: ${name}`,
                  description: 'No se pudieron sincronizar los datos. Se usarán los datos locales si están disponibles.',
              });
          });
      });
      
      return () => {
          unsubscribes.forEach(unsub => unsub());
      }
    };
    
    setupListeners();

  }, [toast, loading, data]);

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
