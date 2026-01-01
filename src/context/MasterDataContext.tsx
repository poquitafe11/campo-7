
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, getDocs, onSnapshot, query } from 'firebase/firestore';
import { getFirebase, isOffline } from '@/lib/firebase';
import type { LoteData, Labor, Assistant, MinMax, Jalador, WorkerMasterItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface MasterData {
  lotes: LoteData[];
  labors: Labor[];
  asistentes: (Assistant & { id: string, assistantName: string, cargo: string })[];
  minMax: MinMax[];
  jaladores: Jalador[];
  trabajadores: WorkerMasterItem[];
}

interface MasterDataContextType extends MasterData {
  loading: boolean;
  error: Error | null;
  refreshData: (forceServer?: boolean) => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

const collectionsConfig = [
    { name: 'maestro-lotes', key: 'lotes', processor: (doc: any) => ({ id: doc.id, ...doc.data(), fechaCianamida: doc.data().fechaCianamida?.toDate ? doc.data().fechaCianamida.toDate() : (doc.data().fechaCianamida ? parseISO(doc.data().fechaCianamida) : new Date()) }) },
    { name: 'maestro-labores', key: 'labors', processor: (doc: any) => ({ codigo: doc.id, ...doc.data() }) },
    { name: 'asistentes', key: 'asistentes', processor: (doc: any) => ({ id: doc.id, assistantName: doc.data().nombre, cargo: doc.data().cargo, personnelCount: 0, absentCount: 0 }) },
    { name: 'min-max', key: 'minMax', processor: (doc: any) => ({ id: doc.id, ...doc.data() }) },
    { name: 'maestro-jaladores', key: 'jaladores', processor: (doc: any) => ({ id: doc.id, ...doc.data() }) },
    { name: 'maestro-trabajadores', key: 'trabajadores', processor: (doc: any) => ({ ...doc.data() as WorkerMasterItem }) },
];

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MasterData>({ lotes: [], labors: [], asistentes: [], minMax: [], jaladores: [], trabajadores: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const loadMasterData = useCallback(async (forceServer = false) => {
    setLoading(true);
    setError(null);
    
    try {
        const { db } = getFirebase();
        
        const allDataPromises = collectionsConfig.map(({ name, key, processor }) =>
            onSnapshot(collection(db, name), (snapshot) => {
                const collectionData = snapshot.docs.map(processor);
                setData(currentData => ({ ...currentData, [key]: collectionData }));
            }, (err) => {
                console.error(`Error loading ${name}:`, err);
                setError(new Error(`Failed to load ${name}.`));
            })
        );
        
        // This sets up listeners, but we can resolve the loading state earlier
        // as onSnapshot provides initial data immediately from cache if available.
        // We'll manage a unified loading state.
        
        // Use getDocs for initial load to manage loading state properly
        const initialLoadPromises = collectionsConfig.map(async ({ name, key, processor }) => {
            const querySnapshot = await getDocs(collection(db, name));
            return { key, data: querySnapshot.docs.map(processor) };
        });

        const allDataResults = await Promise.all(initialLoadPromises);
        const newData: Partial<MasterData> = {};
        allDataResults.forEach(result => {
            (newData as any)[result.key] = result.data;
        });
        
        setData(currentData => ({ ...currentData, ...newData as MasterData }));

    } catch (err: any) {
        console.error(`Critical error loading master data:`, err);
        setError(new Error("No se pudieron cargar los datos maestros. La aplicación puede no funcionar correctamente."));
        toast({
            variant: "destructive",
            title: "Error Crítico de Datos",
            description: "No se pueden cargar los datos maestros. Comprueba tu conexión o contacta a soporte.",
        });
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (user) {
        loadMasterData();
    } else {
        setLoading(false);
    }
  }, [user, loadMasterData]);

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
