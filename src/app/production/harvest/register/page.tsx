
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useMasterData } from '@/context/MasterDataContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, UserPlus, Boxes, Trash2, PlusCircle, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoteData, WorkerMasterItem } from '@/lib/types';


const harvestHeaderSchema = z.object({
  date: z.date({ required_error: 'La fecha es requerida.' }),
  lote: z.string().min(1, 'Debe seleccionar un lote.'),
  groupNumber: z.coerce.number().int().positive('El número de grupo es requerido.'),
});

const personnelSchema = z.object({
    dni: z.string().length(8, 'El DNI debe tener 8 dígitos.'),
    name: z.string().min(3, 'El nombre es requerido.'),
    group: z.string(),
});

const performanceSchema = z.object({
    cuartel: z.string().min(1, 'El cuartel es requerido.'),
    personnelCodes: z.string().min(1, 'Debe ingresar al menos un código de personal.'),
    jabas: z.string().min(1, 'Debe ingresar al menos una cantidad de jabas.'),
});

type HarvestHeaderValues = z.infer<typeof harvestHeaderSchema>;
type PersonnelFormValues = z.infer<typeof personnelSchema>;
type PerformanceFormValues = z.infer<typeof performanceSchema>;

interface PersonnelData extends PersonnelFormValues { id: string; }
interface PerformanceData extends PerformanceFormValues { id: string; }

export default function RegisterHarvestPage() {
  const { setActions } = useHeaderActions();
  const { labors, lotes, trabajadores, loading: masterLoading } = useMasterData();
  const { toast } = useToast();
  
  const [personnel, setPersonnel] = useState<PersonnelData[]>([]);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);

  const [isPersonnelDialogOpen, setIsPersonnelDialogOpen] = useState(false);
  const [isPerformanceDialogOpen, setIsPerformanceDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headerForm = useForm<HarvestHeaderValues>({
    resolver: zodResolver(harvestHeaderSchema),
    defaultValues: { date: new Date(), lote: '', groupNumber: 1 },
  });

  const personnelForm = useForm<PersonnelFormValues>({
    resolver: zodResolver(personnelSchema),
    defaultValues: { dni: '', name: '', group: '' },
  });

  const performanceForm = useForm<PerformanceFormValues>({
      resolver: zodResolver(performanceSchema),
      defaultValues: { cuartel: '', personnelCodes: '', jabas: '' },
  });

  const harvestLabor = useMemo(() => labors.find(l => l.codigo === '67'), [labors]);
  const selectedLote = headerForm.watch('lote');
  const groupNumber = headerForm.watch('groupNumber');
  
  const dniValue = useWatch({ control: personnelForm.control, name: 'dni' });

  useEffect(() => {
    if (dniValue && dniValue.length === 8) {
      const worker = trabajadores.find(t => t.dni === dniValue);
      if (worker) {
        personnelForm.setValue('name', worker.name, { shouldValidate: true });
      }
    }
  }, [dniValue, trabajadores, personnelForm]);

  const uniqueLotes = useMemo(() => {
    const lotesMap = new Map<string, LoteData>();
    lotes.forEach(lote => {
      if (!lotesMap.has(lote.lote)) {
        lotesMap.set(lote.lote, lote);
      }
    });
    return Array.from(lotesMap.values());
  }, [lotes]);
  
  const cuartelesOptions = useMemo(() => {
    if (!selectedLote) return [];
    return lotes.filter(l => l.lote === selectedLote);
  }, [selectedLote, lotes]);


  useEffect(() => {
    setActions({ title: "Registro de Cosecha" });
    return () => setActions({});
  }, [setActions]);
  
  useEffect(() => {
    personnelForm.setValue('group', String(groupNumber));
  }, [groupNumber, personnelForm, isPersonnelDialogOpen]);


  const handleAddPersonnel = (data: PersonnelFormValues) => {
    if(personnel.some(p => p.dni === data.dni)) {
        personnelForm.setError('dni', { message: 'Este DNI ya fue agregado.'});
        return;
    }
    setPersonnel(prev => [...prev, { ...data, id: crypto.randomUUID() }]);
    personnelForm.reset({ dni: '', name: '', group: String(groupNumber) });
    toast({ title: 'Personal Agregado', description: `${data.name} ha sido añadido a la lista.` });
  };
  
  const handleAddPerformance = (data: PerformanceFormValues) => {
      const codes = data.personnelCodes.split('\n').filter(Boolean);
      const jabas = data.jabas.split('\n').filter(Boolean);

      if (codes.length !== jabas.length) {
          performanceForm.setError('jabas', { message: 'La cantidad de códigos y jabas debe ser la misma.' });
          return;
      }
      
      setPerformance(prev => [...prev, { ...data, id: crypto.randomUUID() }]);
      performanceForm.reset({ cuartel: data.cuartel, personnelCodes: '', jabas: '' });
      setIsPerformanceDialogOpen(false);
      toast({ title: 'Rendimiento Agregado', description: `Se agregaron ${codes.length} registros para el cuartel ${data.cuartel}.` });
  };

  const handleFinalSubmit = (data: HarvestHeaderValues) => {
    console.log({
        header: data,
        labor: harvestLabor,
        personnel,
        performance
    });
    setIsSubmitting(true);
    // TODO: Connect to save to database
    setTimeout(() => {
        toast({ title: "Registro Guardado (Simulación)", description: "Los datos de cosecha han sido registrados." });
        setIsSubmitting(false);
        headerForm.reset({ date: new Date(), lote: '', groupNumber: 1 });
        setPersonnel([]);
        setPerformance([]);
    }, 1500);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Encabezado del Parte de Cosecha</CardTitle>
          <CardDescription>Labor: {harvestLabor?.descripcion || 'Cosecha (cargando...)'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...headerForm}>
            <form onSubmit={headerForm.handleSubmit(handleFinalSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={headerForm.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Fecha</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                    <FormMessage /></FormItem>
                )}/>
                <FormField control={headerForm.control} name="lote" render={({ field }) => (
                    <FormItem><FormLabel>Lote</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}><FormControl>
                            <SelectTrigger><SelectValue placeholder={masterLoading ? "Cargando..." : "Seleccionar"} /></SelectTrigger>
                        </FormControl><SelectContent>{uniqueLotes.map(l => <SelectItem key={l.id} value={l.lote}>{l.lote}</SelectItem>)}</SelectContent></Select>
                    <FormMessage /></FormItem>
                )}/>
                 <FormField control={headerForm.control} name="groupNumber" render={({ field }) => (
                    <FormItem><FormLabel>N° Grupo</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage /></FormItem>
                )}/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                 {/* Personnel Dialog Trigger */}
                 <Dialog open={isPersonnelDialogOpen} onOpenChange={setIsPersonnelDialogOpen}>
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline"><UserPlus className="mr-2"/>Agregar Personal</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Agregar Personal al Grupo {groupNumber}</DialogTitle></DialogHeader>
                        <Form {...personnelForm}>
                        <form onSubmit={personnelForm.handleSubmit(handleAddPersonnel)} className="space-y-4">
                            <FormField control={personnelForm.control} name="dni" render={({ field }) => (<FormItem><FormLabel>DNI</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={personnelForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={personnelForm.control} name="group" render={({ field }) => (<FormItem><FormLabel>Grupo</FormLabel><FormControl><Input {...field} readOnly disabled/></FormControl><FormMessage /></FormItem>)}/>
                            <DialogFooter><Button type="submit">Añadir a la lista</Button></DialogFooter>
                        </form>
                        </Form>
                    </DialogContent>
                 </Dialog>

                {/* Performance Dialog Trigger */}
                <Dialog open={isPerformanceDialogOpen} onOpenChange={setIsPerformanceDialogOpen}>
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline"><Boxes className="mr-2"/>Agregar Rendimiento</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader><DialogTitle>Agregar Rendimiento por Cuartel</DialogTitle></DialogHeader>
                         <Form {...performanceForm}>
                            <form onSubmit={performanceForm.handleSubmit(handleAddPerformance)} className="space-y-4">
                                <FormField control={performanceForm.control} name="cuartel" render={({ field }) => (
                                    <FormItem><FormLabel>Cuartel</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl>
                                            <SelectTrigger><SelectValue placeholder={!selectedLote ? "Seleccione un lote primero" : "Seleccionar cuartel"} /></SelectTrigger>
                                        </FormControl><SelectContent>{cuartelesOptions.map(c => <SelectItem key={c.id} value={c.cuartel}>{c.cuartel}</SelectItem>)}</SelectContent></Select>
                                    <FormMessage /></FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-4">
                                     <FormField control={performanceForm.control} name="personnelCodes" render={({ field }) => (
                                        <FormItem><FormLabel>Códigos de Personal</FormLabel><FormControl><Textarea placeholder="Un código por línea..." {...field} className="text-4xl text-center font-bold" /></FormControl><FormMessage /></FormItem>
                                     )}/>
                                     <FormField control={performanceForm.control} name="jabas" render={({ field }) => (
                                        <FormItem><FormLabel>N° de Jabas</FormLabel><FormControl><Textarea placeholder="Un número por línea..." {...field} className="text-4xl text-center font-bold" /></FormControl><FormMessage /></FormItem>
                                     )}/>
                                </div>
                                <DialogFooter><Button type="submit">Añadir Rendimiento</Button></DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
              </div>

               <div className="pt-6">
                 <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Parte de Cosecha
                 </Button>
               </div>

            </form>
          </Form>
        </CardContent>
      </Card>
      
      {/* Tables for preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
              <CardHeader><CardTitle>Personal Agregado</CardTitle></CardHeader>
              <CardContent>
                  <div className="border rounded-md max-h-60 overflow-y-auto">
                      <Table><TableHeader><TableRow><TableHead>DNI</TableHead><TableHead>Nombre</TableHead><TableHead>Grupo</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                          {personnel.length > 0 ? personnel.map(p => (
                              <TableRow key={p.id}><TableCell>{p.dni}</TableCell><TableCell>{p.name}</TableCell><TableCell>{p.group}</TableCell>
                              <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setPersonnel(prev => prev.filter(i => i.id !== p.id))}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>
                          )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No se ha agregado personal.</TableCell></TableRow>}
                      </TableBody></Table>
                  </div>
              </CardContent>
          </Card>
          <Card>
              <CardHeader><CardTitle>Rendimiento Agregado</CardTitle></CardHeader>
              <CardContent>
                  <div className="border rounded-md max-h-60 overflow-y-auto">
                      <Table><TableHeader><TableRow><TableHead>Cuartel</TableHead><TableHead># Registros</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                         {performance.length > 0 ? performance.map(p => (
                             <TableRow key={p.id}><TableCell>{p.cuartel}</TableCell><TableCell>{p.personnelCodes.split('\n').filter(Boolean).length}</TableCell>
                             <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setPerformance(prev => prev.filter(i => i.id !== p.id))}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>
                         )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No se ha agregado rendimiento.</TableCell></TableRow>}
                      </TableBody></Table>
                  </div>
              </CardContent>
          </Card>
      </div>

    </div>
  );
}
