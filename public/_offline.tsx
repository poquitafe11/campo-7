
import Head from 'next/head';

export default function OfflinePage() {
  return (
    <>
      <Head>
        <title>Sin Conexión - Campo 7</title>
      </Head>
      <main className="flex h-screen flex-col items-center justify-center bg-background text-center p-4">
        <h1 className="text-2xl font-bold text-destructive">Estás sin conexión</h1>
        <p className="mt-2 text-muted-foreground">
          La aplicación se ha cargado desde la caché. Puedes seguir trabajando con los datos que ya tienes.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Los nuevos datos se sincronizarán cuando vuelvas a tener internet.
        </p>
      </main>
    </>
  );
}
