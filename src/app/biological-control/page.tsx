
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarIcon, Bug } from "lucide-react";
import { format } from "date-fns";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { BiologicalControlSchema } from "@/lib/types";
import { useAppData } from "@/context/AppDataContext";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

export default function BiologicalControlPage() {
  const { dispatch } = useAppData();
  const { toast } = useToast();
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions(<>Control Biológico</>);
    return () => setActions(null);
  }, [setActions]);

  const form = useForm<z.infer<typeof BiologicalControlSchema>>({
    resolver: zodResolver(BiologicalControlSchema),
    defaultValues: {
      agent: "",
      quantity: 0,
      targetPest: "",
    },
  });

  function onSubmit(values: z.infer<typeof BiologicalControlSchema>) {
    dispatch({ type: "ADD_BIOLOGICAL_CONTROL", payload: values });
    toast({
      title: "¡Éxito!",
      description: "Datos de control biológico guardados.",
    });
    form.reset();
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Control Biológico" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-6 w-6" />
            Nuevo Registro de Control Biológico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="releaseDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Liberación</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Elige una fecha</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agente Biológico</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Mariquitas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="500" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetPest"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plaga Objetivo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Pulgones" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" size="lg">Guardar Datos Biológicos</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
