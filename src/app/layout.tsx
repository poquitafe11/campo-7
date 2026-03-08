
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppDataProvider } from '@/context/AppDataContext';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/useAuth';
import AuthWrapper from '@/components/AuthWrapper';
import { MasterDataProvider } from '@/context/MasterDataContext';
import AppLayout from './AppLayout';
import { HeaderActionsProvider } from '@/contexts/HeaderActionsContext';

const APP_NAME = "Campo 7";
const APP_DESCRIPTION = "Gestiona de forma eficiente los datos de tu campo.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  icons: [
    { rel: "icon", url: "/icon-7.svg" },
    { rel: "apple-touch-icon", url: "/icon-7.svg" },
  ],
};

export const viewport: Viewport = {
  themeColor: "#6d28d9",
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
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
                  <AppLayout>
                    {children}
                  </AppLayout>
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
