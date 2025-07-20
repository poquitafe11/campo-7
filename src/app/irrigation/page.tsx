"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarIcon, Droplets } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { IrrigationSchema } from "@/lib/types";
import { useAppData } from "@/context/AppDataContext";

export default function IrrigationPage() {
  const { dispatch } = useAppData();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof IrrigationSchema>>({
    resolver: zodResolver(IrrigationSchema),
    defaultValues: {
      waterAmount: 0,
      durationMinutes: 0,
    },
  });

  function onSubmit(values: z.infer<typeof IrrigationSchema>) {
    dispatch({ type: "ADD_IRRIGATION", payload: values });
    toast({
      title: "Success!",
      description: "Irrigation data has been saved.",
    });
    form.reset();
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Irrigation Monitoring" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-6 w-6" />
            New Irrigation Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="irrigationDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Irrigation Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                  name="waterAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Water Amount (Liters)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="500" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (Minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="60" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" size="lg">Save Irrigation Data</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
