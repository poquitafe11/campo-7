"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { login } from "./actions";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import InstallButton from "@/components/InstallButton";

const loginSchema = z.object({
  email: z.string().email("Por favor, introduce un correo electrónico válido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);


  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsSubmitting(true);
    
    const serverValidation = await login(values);

    if (!serverValidation.success) {
        toast({
            variant: "destructive",
            title: "Error de inicio de sesión",
            description: serverValidation.message || "No se pudo validar el usuario.",
        });
        setIsSubmitting(false);
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, values.email, values.password);
        toast({
            title: "Éxito",
            description: "Has iniciado sesión correctamente.",
        });
        router.push('/dashboard');
    } catch (error: any) {
        let errorMessage = "Credenciales incorrectas. Por favor, inténtalo de nuevo.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = "El correo electrónico o la contraseña son incorrectos.";
        }
        toast({
            variant: "destructive",
            title: "Error de inicio de sesión",
            description: errorMessage,
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (loading) {
     return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      );
  }

  if (user) {
    return (
       <div className="flex h-screen items-center justify-center bg-background">
         <div className="flex flex-col items-center gap-4">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
           <p className="text-muted-foreground">Redirigiendo...</p>
         </div>
       </div>
     );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Bienvenido</CardTitle>
          <CardDescription>Inicia sesión para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="login-email">Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input
                        id="login-email"
                        name="email"
                        autoComplete="email"
                        type="email"
                        placeholder="tu@correo.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="login-password">Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        id="login-password"
                        name="password"
                        autoComplete="current-password"
                        type="password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={isSubmitting} id="login-submit-btn" name="login-submit-btn">
                   {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Iniciar Sesión
                </Button>
                {isClient && <InstallButton />}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
