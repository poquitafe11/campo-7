import type { Metadata } from 'next';
import './globals.css';
import { AppDataProvider } from '@/context/AppDataContext';
import { Toaster } from '@/components/ui/toaster';

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
      <body className="font-body antialiased">
        <AppDataProvider>
          <main className="container mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
          <Toaster />
        </AppDataProvider>
      </body>
    </html>
  );
}
