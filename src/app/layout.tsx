
"use client";

import './globals.css';
import { AppDataProvider } from '@/context/AppDataContext';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/useAuth';
import AuthWrapper from '@/components/AuthWrapper';
import { MasterDataProvider } from '@/context/MasterDataContext';
import { HeaderActionsProvider } from '@/contexts/HeaderActionsContext';
import { Sidebar } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
      return <>{children}</>;
  }

  return (
      <div className="w-full bg-background min-h-screen">
        <Sidebar />
        <main className="pt-16">
          <div className="overflow-x-auto p-4 md:p-8">
              {children}
          </div>
        </main>
      </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-7.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-7.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <AuthWrapper>
            <MasterDataProvider>
              <AppDataProvider>
                <HeaderActionsProvider>
                  <AppContent>
                    {children}
                  </AppContent>
                </HeaderActionsProvider>
                <Toaster />
              </AppDataProvider>
            </MasterDataProvider>
          </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
