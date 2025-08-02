
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Save, Leaf, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMasterData } from '@/context/MasterDataContext';
import { cn } from '@/lib/utils';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { BudbreakSchema, PhenologySchema } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';


type PhenologyFormValues = z.infer<typeof PhenologySchema>;

const evaluationOptions = [
  { value: 'chargerBuds', label: 'Conteo de cargadores y yemas post poda' },
  { value: 'budbreak', label: 'Brotación', disabled: false },
  { value: 'shootGrowth', label: 'Crecimiento de brote (Próximamente)', disabled: true },
  { value: 'clusterCount', label: 'Conteo de racimos (Próximamente)', disabled: true },
  { value: 'clusterElongation', label: 'Elongación de racimos (Próximamente)', disabled: true },
  { value: 'berrySize', label: 'Calibre (Próximamente)', disabled: true },
  { value: 'brix', label: 'Brix (Próximamente)', disabled: true },
];

export default function CreatePhenologyPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { lotes, loading: masterLoading } = useMasterData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTotalBuds, setLastTotalBuds] = useState<number | null>(null);

  const form = useForm<PhenologyFormValues>({
    resolver: zodResolver(PhenologySchema),
    defaultValues: {
      date: new Date(),
      lote: '',
      cuartel: '',
      evaluationType: '',
      pass: 1,
      chargerBuds: {
        totalChargers: 0,
        weakChargers: 0,
        vigorousChargers: 0,
        totalBuds: 0,
        budsOnWeak: 0,
        budsOnVigorous: 0,
      },
      budbreak: {
        evaluationMethod: 'random',
        totalBuds: 0,
        swollenBuds: 0,
        cottonBuds: 0,
        greenTipBuds: 0,
        unfoldedLeaves: 0,
      }
    },
  });

  const selectedLote = useWatch({ control: form.control, name: 'lote' });
  const selectedEvaluation = useWatch({ control: form.control, name: 'evaluationType' });
  
  const chargerBudsValues = useWatch({ control: form.control, name: 'chargerBuds' });
  const budbreakValues = useWatch({ control: form.control, name: 'budbreak' });

  const cuartelesOptions = useMemo(() => {
    if (!selectedLote) return [];
    return lotes.filter(l => l.lote === selectedLote).map(l => ({ id: l.id, cuartel: l.cuartel }));
  }, [selectedLote, lotes]);
  
  const uniqueLotes = useMemo(() => {
    return [...new Map(lotes.map(lote => [lote.lote, lote])).values()];
  }, [lotes]);

  const normalChargers = useMemo(() => {
    if (!chargerBudsValues) return 0;
    const { totalChargers = 0, weakChargers = 0, vigorousChargers = 0 } = chargerBudsValues;
    return totalChargers - weakChargers - vigorousChargers;
  }, [chargerBudsValues]);

  const budsOnNormal = useMemo(() => {
    if (!chargerBudsValues) return 0;
    const { totalBuds = 0, budsOnWeak = 0, budsOnVigorous = 0 } = chargerBudsValues;
    return totalBuds - budsOnWeak - budsOnVigorous;
  }, [chargerBudsValues]);
  
  const selectedCuartelId = useWatch({ control: form.control, name: "cuartel" });
  const plantNumber = useWatch({ control: form.control, name: "budbreak.plantNumber" });
  const pass = useWatch({ control: form.control, name: "pass" });
  
  const fetchLastPass = useCallback(async () => {
    if (selectedCuartelId && selectedEvaluation) {
      try {
        const q = query(
          collection(db, "evaluaciones-fenologia"),
          where("cuartel", "==", selectedCuartelId),
          where("evaluationType", "==", selectedEvaluation)
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          form.setValue('pass', 1);
        } else {
          let maxPass = 0;
          querySnapshot.forEach(doc => {
            const docPass = doc.data().pass;
            if (docPass > maxPass) {
              maxPass = docPass;
            }
          });
          form.setValue('pass', maxPass + 1);
        }
      } catch (error) {
        console.error("Error fetching last pass: ", error);
        // Set to 1 as a fallback if query fails
        form.setValue('pass', 1);
      }
    }
  }, [selectedCuartelId, selectedEvaluation, form]);

  useEffect(() => {
    fetchLastPass();
  }, [fetchLastPass]);

  useEffect(() => {
    const fetchLastPlantData = async () => {
        if (selectedEvaluation === 'budbreak' && budbreakValues?.evaluationMethod === 'tracking' && plantNumber && pass > 1) {
            const q = query(
                collection(db, "evaluaciones-fenologia"),
                where("cuartel", "==", selectedCuartelId),
                where("evaluationType", "==", "budbreak"),
                where("budbreak.evaluationMethod", "==", "tracking"),
                where("budbreak.plantNumber", "==", plantNumber),
                where("pass", "==", pass - 1),
                limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const lastData = querySnapshot.docs[0].data() as PhenologyFormValues;
                if(lastData.budbreak?.totalBuds) {
                    form.setValue('budbreak.totalBuds', lastData.budbreak.totalBuds);
                    setLastTotalBuds(lastData.budbreak.totalBuds);
                }
            } else {
                setLastTotalBuds(null);
            }
        } else {
            setLastTotalBuds(null);
        }
    }
    fetchLastPlantData();
  }, [selectedCuartelId, selectedEvaluation, pass, plantNumber, budbreakValues?.evaluationMethod, form]);


  const onSubmit = async (data: PhenologyFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "Debe estar autenticado.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const docData = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        lote: selectedLote,
        createdBy: user.email,
        createdAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, 'evaluaciones-fenologia'), docData);
      
      toast({
        title: "Éxito",
        description: `Evaluación de "${evaluationOptions.find(opt => opt.value === data.evaluationType)?.label}" guardada.`,
      });

      form.reset({
        ...form.getValues(),
        pass: form.getValues('pass') + 1,
        chargerBuds: { totalChargers: 0, weakChargers: 0, vigorousChargers: 0, totalBuds: 0, budsOnWeak: 0, budsOnVigorous: 0 },
        budbreak: { evaluationMethod: 'random', totalBuds: 0, swollenBuds: 0, cottonBuds: 0, greenTipBuds: 0, unfoldedLeaves: 0, plantNumber: undefined },
      });

    } catch (error) {
      console.error("Error saving phenology data: ", error);
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: "No se pudo guardar la evaluación.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderChargerBudsForm = () => (
    <div className="space-y-4 rounded-md border p-4">
      <h4 className="font-semibold text-md">Conteo de Cargadores y Yemas</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FormField
          control={form.control}
          name="chargerBuds.totalChargers"
          render={({ field }) => (
            <FormItem><FormLabel>Cargadores Totales</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="chargerBuds.weakChargers"
          render={({ field }) => (
            <FormItem><FormLabel>C. Débiles</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="chargerBuds.vigorousChargers"
          render={({ field }) => (
            <FormItem><FormLabel>C. Vigorosos</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
          )}
        />
        <FormItem>
          <FormLabel>C. Normales</FormLabel>
          <FormControl><Input type="number" value={normalChargers} readOnly disabled className="bg-muted" /></FormControl>
        </FormItem>
      </div>
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <FormField
          control={form.control}
          name="chargerBuds.totalBuds"
          render={({ field }) => (
            <FormItem><FormLabel>Yemas Totales</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="chargerBuds.budsOnWeak"
          render={({ field }) => (
            <FormItem><FormLabel>Yemas en Débiles</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="chargerBuds.budsOnVigorous"
          render={({ field }) => (
            <FormItem><FormLabel>Yemas en Vigorosos</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Yemas en Normales</FormLabel>
          <FormControl><Input type="number" value={budsOnNormal} readOnly disabled className="bg-muted" /></FormControl>
        </FormItem>
      </div>
    </div>
  );
  
  const budbreakPercentage = useMemo(() => {
    if (!budbreakValues) return 0;
    const total = parseFloat(String(budbreakValues.totalBuds || 0));
    const greenTip = parseFloat(String(budbreakValues.greenTipBuds || 0));
    const unfolded = parseFloat(String(budbreakValues.unfoldedLeaves || 0));
  
    if (isNaN(total) || total === 0) return 0;
    
    return ((greenTip + unfolded) / total) * 100;
  }, [budbreakValues]);

  const renderBudbreakForm = () => (
     <div className="space-y-4 rounded-md border p-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center">
            <h4 className="font-semibold text-md">Evaluación de Brotación</h4>
             <Badge variant="secondary" className="text-base px-3 py-1">
                % Brotación: {budbreakPercentage.toFixed(2)}%
            </Badge>
        </div>
      
        <FormField control={form.control} name="budbreak.evaluationMethod" render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Método de Evaluación</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="random" /></FormControl><FormLabel className="font-normal">Al Azar</FormLabel></FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="tracking" /></FormControl><FormLabel className="font-normal">Seguimiento</FormLabel></FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
        )}/>
      
        {budbreakValues?.evaluationMethod === 'tracking' && (
            <FormField control={form.control} name="budbreak.plantNumber" render={({ field }) => (
                <FormItem><FormLabel>Número de Planta</FormLabel><FormControl><Input type="number" placeholder="Ingrese el número de la planta marcada" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FormField control={form.control} name="budbreak.totalBuds" render={({ field }) => (
                <FormItem><FormLabel>Yemas Totales</FormLabel><FormControl><Input type="number" {...field} disabled={lastTotalBuds !== null} /></FormControl><FormMessage /></FormItem>
            )}/>
             <FormField control={form.control} name="budbreak.swollenBuds" render={({ field }) => (
                <FormItem><FormLabel>Y. Hinchadas</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
             <FormField control={form.control} name="budbreak.cottonBuds" render={({ field }) => (
                <FormItem><FormLabel>Algodón</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
             <FormField control={form.control} name="budbreak.greenTipBuds" render={({ field }) => (
                <FormItem><FormLabel>Punta Verde</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
             <FormField control={form.control} name="budbreak.unfoldedLeaves" render={({ field }) => (
                <FormItem><FormLabel>Hojas Desplegadas</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
        </div>
     </div>
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Evaluación Fenológica" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Leaf className="h-6 w-6"/>Nuevo Registro Fenológico</CardTitle>
          <CardDescription>
            Selecciona el lote, cuartel y tipo de evaluación para registrar los datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Fecha</FormLabel>
                    <Popover><PopoverTrigger asChild>
                        <FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button></FormControl>
                    </PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent></Popover><FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="lote" render={({ field }) => (
                    <FormItem><FormLabel>Lote</FormLabel><Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar lote"} /></SelectTrigger></FormControl>
                        <SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )}/>
                 <FormField control={form.control} name="cuartel" render={({ field }) => (
                    <FormItem><FormLabel>Cuartel</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedLote}>
                        <FormControl><SelectTrigger><SelectValue placeholder={!selectedLote ? "Selecciona un lote" : "Seleccionar cuartel"} /></SelectTrigger></FormControl>
                        <SelectContent>{cuartelesOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.cuartel}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )}/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="evaluationType" render={({ field }) => (
                   <FormItem><FormLabel>Tipo de Evaluación</FormLabel><Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar evaluación" /></SelectTrigger></FormControl>
                        <SelectContent>{evaluationOptions.map(opt => <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="pass" render={({ field }) => (
                   <FormItem><FormLabel>Pasada N°</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>

              {selectedEvaluation === 'chargerBuds' && renderChargerBudsForm()}
              {selectedEvaluation === 'budbreak' && renderBudbreakForm()}
              
              <div className="flex justify-end pt-4">
                 <Button type="submit" size="lg" disabled={isSubmitting || !selectedEvaluation}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Evaluación
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
