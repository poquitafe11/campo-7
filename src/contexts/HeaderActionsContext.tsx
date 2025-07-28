
"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface HeaderActionsContextType {
  actions: React.ReactNode;
  setActions: (actions: React.ReactNode) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextType | undefined>(undefined);

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<React.ReactNode>(null);

  const value = { actions, setActions };

  return (
    <HeaderActionsContext.Provider value={value}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions() {
  const context = useContext(HeaderActionsContext);
  if (context === undefined) {
    throw new Error('useHeaderActions must be used within a HeaderActionsProvider');
  }
  return context;
}
