
"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BotMessageSquare, Sparkles } from "lucide-react";
import { es } from 'date-fns/locale';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { QuerySchema } from "@/lib/types";
import { askQuery } from "./actions";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

export default function QueriesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Consultas IA" });
    return () => setActions({});
  }, [setActions]);

  const form = useForm<z.infer<typeof QuerySchema>>({
    resolver: zodResolver(QuerySchema),
    defaultValues: {
      query: "",
    },
  });

  async function onSubmit(values: z.infer<typeof QuerySchema>) {
    setIsLoading(true);
    setAnswer(null);
    setError(null);

    const result = await askQuery(values.query);

    if (result.error) {
      setError(result.error);
    } else {
      setAnswer(result.answer ?? null);
    }

    setIsLoading(false);
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BotMessageSquare className="h-6 w-6" />
            Haz una Pregunta
          </CardTitle>
          <CardDescription>
            Usa los datos recolectados de producción, sanidad y riego para obtener información y análisis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tu Pregunta</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ej: 'Compara el rendimiento por hectárea entre los lotes este mes' o '¿Qué tratamientos de sanidad se aplicaron la semana pasada?'"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-wrap gap-4 items-center">
                <Button type="submit" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                      Pensando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Preguntar a la IA
                    </>
                  )}
                </Button>
              </div>

            </form>
          </Form>

          {(isLoading || answer || error) && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4">Respuesta</h3>
              {isLoading && (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded-full w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded-full w-1/2 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded-full w-5/6 animate-pulse"></div>
                </div>
              )}
              {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                  <p>{error}</p>
                </div>
              )}
              {answer && (
                <div className="p-4 bg-primary/10 rounded-md prose dark:prose-invert max-w-none text-foreground">
                    <p>{answer}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
