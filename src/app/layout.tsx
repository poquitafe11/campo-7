import type { Metadata } from 'next';
import './globals.css';
import { AppDataProvider } from '@/context/AppDataContext';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/useAuth';
import AuthWrapper from '@/components/AuthWrapper';
import AppLayout from '@/components/AppLayout';

export const metadata: Metadata = {
  title: 'Brujos Field Management',
  description: 'Efficiently manage your field data with Brujos.',
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
      </head>
      <body className="font-body antialiased bg-background">
        <AuthProvider>
            <AuthWrapper>
                <AppLayout>
                    <AppDataProvider>
                        {children}
                        <Toaster />
                    </AppDataProvider>
                </AppLayout>
            </AuthWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
