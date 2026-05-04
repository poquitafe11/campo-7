
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { collection, getDocs, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LoteData, Labor, Assistant, MinMax, Jalador, WorkerMasterItem, Presupuesto } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { parseISO, isValid } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface MasterData {
  lotes: LoteData[];
  labors: Labor[];
  asistentes: (Assistant & { id: string, assistantName: string, cargo: string })[];
  minMax: MinMax[];
  jaladores: Jalador[];
  trabajadores: WorkerMasterItem[];
  presupuestos: Presupuesto[];
}

interface MasterDataContextType extends MasterData {
  loading: boolean;
  error: Error | null;
  refreshData: (forceServer?: boolean) => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

const collectionsConfig = [
    { 
        name: 'maestro-lotes', 
        key: 'lotes', 
        processor: (doc: any) => {
            const data = doc.data();
            const val = data.fechaCianamida;
            let date: Date;
            
            if (val?.toDate) {
                date = val.toDate();
            } else if (val instanceof Date) {
                date = val;
            } else if (typeof val === 'string') {
                const parsed = parseISO(val);
                date = isValid(parsed) ? parsed : new Date();
            } else {
                date = new Date();
            }

            return { 
                id: doc.id, 
                ...data, 
                fechaCianamida: date 
            };
        } 
    },
    { name: 'maestro-labores', key: 'labors', processor: (doc: any) => ({ codigo: doc.id, ...doc.data() }) },
    { 
        name: 'asistentes', 
        key: 'asistentes', 
        processor: (doc: any) => ({ 
            id: doc.id, 
            assistantName: doc.data().nombre || doc.data().assistantName, 
            cargo: doc.data().cargo || "Asistente", 
            personnelCount: 0, 
            absentCount: 0 
        }) 
    },
    { name: 'min-max', key: 'minMax', processor: (doc: any) => ({ id: doc.id, ...doc.data() }) },
    { name: 'maestro-jaladores', key: 'jaladores', processor: (doc: any) => ({ id: doc.id, ...doc.data() }) },
    { name: 'maestro-trabajadores', key: 'trabajadores', processor: (doc: any) => ({ ...doc.data() as WorkerMasterItem }) },
    { name: 'presupuesto', key: 'presupuestos', processor: (doc: any) => ({ id: doc.id, ...doc.data() }) },
];

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MasterData>({ lotes: [], labors: [], asistentes: [], minMax: [], jaladores: [], trabajadores: [], presupuestos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !db) {
        setLoading(false);
        return;
    }

    setLoading(true);
    
    const unsubscribes = collectionsConfig.map(({ name, key, processor }) => {
        return onSnapshot(collection(db, name), (snapshot) => {
            const newData = snapshot.docs.map(processor);
            setData(prev => ({ ...prev, [key]: newData }));
            setLoading(false);
        }, (err: any) => {
            // Silenciamos el error si es por falta de permisos al cerrar sesión
            if (err.code === 'permission-denied') {
                return;
            }
            console.error(`Error en tiempo real para ${name}:`, err);
        });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user]);

  const refreshData = useCallback(async () => {
    if (!db) return;
    try {
        const results = await Promise.all(collectionsConfig.map(async ({ name, key, processor }) => {
            const snap = await getDocs(collection(db, name));
            return { key, data: snap.docs.map(processor) };
        }));
        const newData: any = {};
        results.forEach(r => newData[r.key] = r.data);
        setData(prev => ({ ...prev, ...newData }));
    } catch (err) {
        console.error("Error refrescando datos:", err);
    }
  }, []);

  const value = { ...data, loading, error, refreshData };

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
