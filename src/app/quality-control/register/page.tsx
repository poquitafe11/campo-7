
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarIcon, BadgeCheck } from "lucide-react";
import { format } from "date-fns";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { QualityControlSchema } from "@/lib/types";
import { useAppData } from "@/context/AppDataContext";
import { useHeaderActions } from "@/contexts/HeaderActionsContext";

export default function RegisterQualityControlPage() {
  const { dispatch } = useAppData();
  const { toast } = useToast();
  const { setActions } = useHeaderActions();

  useEffect(() => {
    setActions({ title: "Control de Calidad" });
    return () => setActions({});
  }, [setActions]);


  const form = useForm<z.infer<typeof QualityControlSchema>>({
    resolver: zodResolver(QualityControlSchema),
    defaultValues: {
      brix: 10,
      firmness: 80,
      color: "",
    },
  });

  function onSubmit(values: z.infer<typeof QualityControlSchema>) {
    dispatch({ type: "ADD_QUALITY_CONTROL", payload: values });
    toast({
      title: "¡Éxito!",
      description: "Datos de control de calidad guardados.",
    });
    form.reset();
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-6 w-6" />
            Nuevo Registro de Calidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="sampleDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Muestra</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
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
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Rojo brillante" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brix (Dulzura)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="firmness"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firmeza (%)</FormLabel>
                    <FormControl>
                       <div className="flex items-center gap-4">
                        <Slider
                          defaultValue={[field.value]}
                          max={100}
                          step={1}
                          onValueChange={(value) => field.onChange(value[0])}
                        />
                         <span className="text-sm font-medium w-12 text-right">{field.value}%</span>
                       </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg">Guardar Datos de Calidad</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
