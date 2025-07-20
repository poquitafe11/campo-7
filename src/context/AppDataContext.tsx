"use client";

import React, { createContext, useContext, useReducer, ReactNode } from "react";
import type { 
  AppState, 
  ProductionData, 
  HealthData, 
  IrrigationData, 
  QualityControlData, 
  BiologicalControlData 
} from "@/lib/types";

type Action =
  | { type: 'ADD_PRODUCTION'; payload: ProductionData }
  | { type: 'ADD_HEALTH'; payload: HealthData }
  | { type: 'ADD_IRRIGATION'; payload: IrrigationData }
  | { type: 'ADD_QUALITY_CONTROL'; payload: QualityControlData }
  | { type: 'ADD_BIOLOGICAL_CONTROL'; payload: BiologicalControlData };

const initialState: AppState = {
  production: [],
  health: [],
  irrigation: [],
  qualityControl: [],
  biologicalControl: [],
};

const AppDataContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'ADD_PRODUCTION':
      return { ...state, production: [...state.production, action.payload] };
    case 'ADD_HEALTH':
      return { ...state, health: [...state.health, action.payload] };
    case 'ADD_IRRIGATION':
      return { ...state, irrigation: [...state.irrigation, action.payload] };
    case 'ADD_QUALITY_CONTROL':
      return { ...state, qualityControl: [...state.qualityControl, action.payload] };
    case 'ADD_BIOLOGICAL_CONTROL':
      return { ...state, biologicalControl: [...state.biologicalControl, action.payload] };
    default:
      return state;
  }
};

export const AppDataProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppDataContext.Provider value={{ state, dispatch }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
