
"use client";

import { useState, useMemo, useEffect } from 'react';
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
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

const chargerBudsSchema = z.object({
  totalChargers: z.coerce.number().min(0, "Debe ser positivo."),
  weakChargers: z.coerce.number().min(0, "Debe ser positivo."),
  vigorousChargers: z.coerce.number().min(0, "Debe ser positivo."),
  totalBuds: z.coerce.number().min(0, "Debe ser positivo."),
  budsOnWeak: z.coerce.number().min(0, "Debe ser positivo."),
  budsOnVigorous: z.coerce.number().min(0, "Debe ser positivo."),
}).refine(data => data.totalChargers >= (data.weakChargers + data.vigorousChargers), {
  message: "La suma de cargadores débiles y vigorosos no puede superar el total.",
  path: ["totalChargers"],
});

const basePhenologySchema = z.object({
  date: z.date({ required_error: 'La fecha es obligatoria.' }),
  lote: z.string().min(1, 'El lote es requerido.'),
  cuartel: z.string().min(1, 'El cuartel es requerido.'),
  evaluationType: z.string().min(1, 'Debe seleccionar un tipo de evaluación.'),
  pass: z.coerce.number().int().min(1, 'La pasada debe ser al menos 1.'),
  chargerBuds: chargerBudsSchema.optional(),
  // Add other evaluation schemas here later
});

type PhenologyFormValues = z.infer<typeof basePhenologySchema>;

const evaluationOptions = [
  { value: 'chargerBuds', label: 'Conteo de cargadores y yemas post poda' },
  { value: 'budbreak', label: 'Brotación (Próximamente)', disabled: true },
  { value: 'shootGrowth', label: 'Crecimiento de brote (Próximamente)', disabled: true },
  { value: 'clusterCount', label: 'Conteo de racimos (Próximamente)', disabled: true },
  { value: 'clusterElongation', label: 'Elongación de racimos (Próximamente)', disabled: true },
  { value: 'berrySize', label: 'Calibre (Próximamente)', disabled: true },
  { value: 'brix', label: 'Brix (Próximamente)', disabled: true },
];

export default function PhenologyPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { lotes, loading: masterLoading } = useMasterData();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PhenologyFormValues>({
    resolver: zodResolver(basePhenologySchema),
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
      }
    },
  });

  const selectedLote = useWatch({ control: form.control, name: 'lote' });
  const selectedEvaluation = useWatch({ control: form.control, name: 'evaluationType' });
  
  const chargerBudsValues = useWatch({ control: form.control, name: 'chargerBuds' });

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

  useEffect(() => {
    const fetchLastPass = async () => {
        if (selectedCuartelId && selectedEvaluation) {
            const q = query(
                collection(db, "evaluaciones-fenologia"),
                where("cuartel", "==", selectedCuartelId),
                where("evaluationType", "==", selectedEvaluation)
            );
            const querySnapshot = await getDocs(q);
            const maxPass = querySnapshot.docs.reduce((max, doc) => Math.max(max, doc.data().pass || 0), 0);
            form.setValue('pass', maxPass + 1);
        }
    };
    fetchLastPass();
  }, [selectedCuartelId, selectedEvaluation, form]);


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
