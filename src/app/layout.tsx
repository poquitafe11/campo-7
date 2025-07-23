import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppDataProvider } from '@/context/AppDataContext';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/useAuth';
import AuthWrapper from '@/components/AuthWrapper';
import DynamicAppLayout from '@/components/DynamicAppLayout';
import { MasterDataProvider } from '@/context/MasterDataContext';

const APP_NAME = "Campo 7";
const APP_DESCRIPTION = "Gestiona de forma eficiente los datos de tu campo con Brujos.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#38A3A5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="/icons/icon-7-32x32.png" sizes="32x32" />
        <link rel="icon" href="/icons/icon-7-192x192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icons/icon-7-192x192.png"></link>
      </head>
      <body className="font-body antialiased bg-background">
        <AuthProvider>
          <AuthWrapper>
            <MasterDataProvider>
              <DynamicAppLayout>
                  <AppDataProvider>
                      {children}
                      <Toaster />
                  </AppDataProvider>
              </DynamicAppLayout>
            </MasterDataProvider>
          </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
