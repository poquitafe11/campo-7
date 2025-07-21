
"use client";

import { useState, useEffect } from 'react';
import { getFirestore, onSnapshot, collection } from 'firebase/firestore';

export type NetworkStatus = 'online' | 'offline' | 'syncing';

export function useOnlineStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [hasPendingWrites, setHasPendingWrites] = useState<boolean>(false);

  useEffect(() => {
    // Check initial online status
    if (typeof navigator.onLine !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    
    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for pending writes with Firestore
    try {
      const db = getFirestore();
      // This is a bit of a trick. We listen to snapshot metadata.
      // `hasPendingWrites` will be true if there are local changes not yet synced.
      const unsubscribe = onSnapshot(collection(db, 'usuarios'), { includeMetadataChanges: true }, (snapshot) => {
        setHasPendingWrites(snapshot.metadata.hasPendingWrites);
      });
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        unsubscribe();
      };
    } catch (error) {
        console.warn("Could not set up Firestore pending writes listener. This can happen if Firebase is not initialized yet.");
        // Cleanup just the window listeners
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }

  }, []);

  if (!isOnline) {
    return 'offline';
  }
  if (hasPendingWrites) {
    return 'syncing';
  }
  return 'online';
}
