
"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface HeaderActions {
  title?: React.ReactNode;
  right?: React.ReactNode;
}

interface HeaderActionsContextType {
  actions: HeaderActions;
  setActions: (actions: HeaderActions) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextType | undefined>(undefined);

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<HeaderActions>({ title: "Áreas de Gestión", right: null });

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
