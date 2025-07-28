import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppDataProvider } from '@/context/AppDataContext';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/useAuth';
import AuthWrapper from '@/components/AuthWrapper';
import { MasterDataProvider } from '@/context/MasterDataContext';
import AppLayout from '@/components/AppLayout';

const APP_NAME = "Campo 7";
const APP_DESCRIPTION = "Gestiona de forma eficiente los datos de tu campo.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: "#4338ca", // Deep purple from the design
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
      <body className="font-sans antialiased bg-background">
        <AuthProvider>
          <AuthWrapper>
            <MasterDataProvider>
                <AppDataProvider>
                  <AppLayout>
                    {children}
                  </AppLayout>
                  <Toaster />
                </AppDataProvider>
            </MasterDataProvider>
          </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
