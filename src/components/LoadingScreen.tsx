
"use client";

import React from 'react';

export default function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="relative flex items-center justify-center">
        {/* Ring animation */}
        <div className="absolute h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
        
        {/* Logo */}
        <img 
          src="/icon-7.svg" 
          alt="campo 7" 
          className="h-16 w-16 rounded-xl shadow-lg z-10 animate-pulse"
        />
      </div>
      
      {message && (
        <p className="mt-6 text-sm font-medium text-muted-foreground animate-pulse">
          {message}
        </p>
      )}
      
      <div className="mt-2 text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">
        campo 7
      </div>
    </div>
  );
}
