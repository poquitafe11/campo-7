"use client";

import dynamic from 'next/dynamic';

// Dynamically import AppLayout and disable server-side rendering (SSR)
// This ensures that all components within AppLayout (like the PWA install button logic)
// only run on the client-side, preventing hydration errors.
const DynamicAppLayout = dynamic(() => import('@/components/AppLayout'), {
  ssr: false,
});

export default DynamicAppLayout;
