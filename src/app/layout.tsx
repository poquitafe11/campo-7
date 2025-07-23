import type { Metadata } from 'next';
import './globals.css';
import { AppDataProvider } from '@/context/AppDataContext';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/useAuth';
import AuthWrapper from '@/components/AuthWrapper';
import DynamicAppLayout from '@/components/DynamicAppLayout';

export const metadata: Metadata = {
  title: 'Campo 7',
  description: 'Gestiona de forma eficiente los datos de tu campo con Brujos.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#8b5cf6" />
      </head>
      <body className="font-body antialiased bg-background">
        <AuthProvider>
            <AuthWrapper>
                <DynamicAppLayout>
                    <AppDataProvider>
                        {children}
                        <Toaster />
                    </AppDataProvider>
                </DynamicAppLayout>
            </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
