"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CalendarIcon, BadgeCheck } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { QualityControlSchema } from "@/lib/types";
import { useAppData } from "@/context/AppDataContext";

export default function QualityControlPage() {
  const { dispatch } = useAppData();
  const { toast } = useToast();

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
      title: "Success!",
      description: "Quality control data has been saved.",
    });
    form.reset();
  }

  return (
    <>
      <PageHeader title="Quality Control" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-6 w-6" />
            New Quality Log
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
                    <FormLabel>Sample Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
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
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Bright Red" {...field} />
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
                    <FormLabel>Brix (Sweetness)</FormLabel>
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
                    <FormLabel>Firmness (%)</FormLabel>
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
              <Button type="submit" size="lg">Save Quality Data</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
