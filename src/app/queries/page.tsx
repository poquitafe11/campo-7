"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BotMessageSquare, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { QuerySchema } from "@/lib/types";
import { useAppData } from "@/context/AppDataContext";
import { askQuery } from "./actions";

export default function QueriesPage() {
  const { state: appData } = useAppData();
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    const result = await askQuery(values.query, appData);

    if (result.error) {
      setError(result.error);
    } else {
      setAnswer(result.answer ?? null);
    }

    setIsLoading(false);
  }

  const hasData = [
    ...appData.production, 
    ...appData.health, 
    ...appData.irrigation,
    ...appData.qualityControl,
    ...appData.biologicalControl
  ].length > 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="AI Query Assistant" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BotMessageSquare className="h-6 w-6" />
            Ask a Question
          </CardTitle>
          <CardDescription>
            Use your collected field data to get insights. The more data you enter, the better the answers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasData && (
            <div className="mb-6 p-4 text-center bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                You haven't recorded any data yet. Please add some data in other sections for the AI assistant to work.
              </p>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Question</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'What was the average yield for strawberries last month?' or 'Were there any disease outbreaks in the last two weeks?'"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" disabled={isLoading || !hasData}>
                {isLoading ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Ask AI
                  </>
                )}
              </Button>
            </form>
          </Form>

          {(isLoading || answer || error) && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4">Answer</h3>
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
                <div className="p-4 bg-primary/10 text-primary-foreground rounded-md prose dark:prose-invert max-w-none">
                    <p className="text-foreground">{answer}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
