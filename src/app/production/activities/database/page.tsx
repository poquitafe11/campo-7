
"use client";

import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  getFilteredRowModel,
} from '@tanstack/react-table';
import { collection, onSnapshot, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { getFirebase, db } from '@/lib/firebase';
import { format, getWeek, parseISO, differenceInDays, isValid, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ActivityRecordData, User, LoteData, Presupuesto, MinMax, Assistant } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Loader2, ChevronLeft, ChevronRight, FileDown, Filter, Calendar as CalendarIcon, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EditActivityDialog from '@/components/EditActivityDialog'; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import * as xlsx from "xlsx";
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useMasterData } from '@/context/MasterDataContext';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';


type ActivityRecordWithId = ActivityRecordData & { id: string };

interface Filters {
    campaign: string;
    stage: string;
    lote: string;
    labor: string;
    pass: string;
    dateRange?: DateRange;
}

const getInitialFilters = (): Filters => ({
    campaign: '',
    stage: '',
    lote: '',
    labor: '',
    pass: '',
    dateRange: { from: undefined, to: undefined },
});

export default function ActivityDatabasePage() {
  const [data, setData] = useState<ActivityRecordWithId[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [minMax, setMinMax] = useState<MinMax[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityRecordWithId | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const { lotes, asistentes, loading: masterLoading } = useMasterData();
  const { setActions } = useHeaderActions();

  const [globalFilter, setGlobalFilter] = useState('');
  const [activeFilters, setActiveFilters] = useState<Filters>(getInitialFilters());
  const [popoverFilters, setPopoverFilters] = useState<Filters>(getInitialFilters());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
        const [
            usersSnapshot, 
            presupuestoSnapshot, 
            minMaxSnapshot, 
            activitiesSnapshot
        ] = await Promise.all([
            getDocs(collection(db, "usuarios")),
            getDocs(collection(db, "presupuesto")),
            getDocs(collection(db, "min-max")),
            getDocs(query(collection(db, "actividades"), orderBy("registerDate", "desc")))
        ]);

        const usersData = usersSnapshot.docs.map(doc => ({...doc.data(), id: doc.id }) as User);
        setUsers(usersData);
        
        const presupuestoData = presupuestoSnapshot.docs.map(doc => ({...doc.data(), id: doc.id }) as Presupuesto);
        setPresupuestos(presupuestoData);
        
        const minMaxData = minMaxSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MinMax));
        setMinMax(minMaxData);
        
        const recordsData = activitiesSnapshot.docs.map(doc => {
            const docData = doc.data();
            let registerDate: Date;
            if (docData.registerDate?.toDate) {
                registerDate = docData.registerDate.toDate();
            } else if (typeof docData.registerDate === 'string') {
                registerDate = parseISO(docData.registerDate);
            } else {
                registerDate = new Date();
            }
            return { ...docData, id: doc.id, registerDate } as ActivityRecordWithId;
        });
        setData(recordsData);

    } catch (error) {
        console.error("Error fetching data: ", error);
        toast({
            title: "Error de Conexión",
            description: "No se pudieron cargar los registros. Intente sincronizar.",
            variant: "destructive"
        });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(user => {
        map.set(user.email, user);
    });
    // Add special admin user
    map.set('marcoromau@gmail.com', {
        email: 'marcoromau@gmail.com',
        nombre: 'Marco Romau',
        rol: 'Admin',
        active: true,
        dni: '00000000',
        celular: '000000000'
    });
    return map;
  }, [users]);

  const assistantMap = useMemo(() => {
    const map = new Map<string, Assistant>();
    asistentes.forEach(a => map.set(a.id, a));
    return map;
  }, [asistentes]);
  
  const lotesMap = useMemo(() => {
    const map = new Map<string, LoteData>();
    lotes.forEach(lote => {
      // Create a representative entry for each unique lot number
      if (!map.has(lote.lote)) {
        map.set(lote.lote, lote);
      }
    });
    return map;
  }, [lotes]);
  
  const loteHaProdMap = useMemo(() => {
    const haMap = new Map<string, number>();
    lotes.forEach(lote => {
        const currentHa = haMap.get(lote.lote) || 0;
        haMap.set(lote.lote, currentHa + (lote.haProd || 0));
    });
    return haMap;
  }, [lotes]);
  
  const presupuestoMap = useMemo(() => {
    const map = new Map<string, Presupuesto>();
    presupuestos.forEach(p => {
        const loteKey = parseInt(p.lote, 10);
        const key = `${loteKey}-${p.descripcionLabor}`;
        map.set(key, p);
    });
    return map;
  }, [presupuestos]);

  const minMaxMap = useMemo(() => {
    const map = new Map<string, MinMax>();
    minMax.forEach(item => {
      const key = `${item.campana}-${item.lote}-${item.codigo}-${item.pasada}`;
      map.set(key, item);
    });
    return map;
  }, [minMax]);

  useEffect(() => {
    setActions({
        title: "Base de Datos de Actividades",
        right: <Button onClick={() => fetchData()} disabled={loading} variant="ghost" size="icon"><RefreshCcw className="h-5 w-5"/></Button>
    });
    return () => setActions({});
  }, [setActions, fetchData, loading]);
  
  const cumulativeJrHaMap = useMemo(() => {
    const cumulativeMap = new Map<string, number>();
    const tempTotals = new Map<string, number>();

    // Sort data chronologically (oldest first) to calculate cumulative sum correctly
    const sortedData = [...data].sort((a, b) => a.registerDate.getTime() - b.registerDate.getTime());

    sortedData.forEach(item => {
        const key = `${item.lote}-${item.labor}`;
        const totalHaProdForLote = loteHaProdMap.get(item.lote) || 0;
        const jrHa = totalHaProdForLote > 0 ? (item.workdayCount || 0) / totalHaProdForLote : 0;
        
        const currentCumulative = tempTotals.get(key) || 0;
        const newCumulative = currentCumulative + jrHa;
        
        tempTotals.set(key, newCumulative);
        cumulativeMap.set(item.id, newCumulative);
    });

    return cumulativeMap;
  }, [data, loteHaProdMap]);

  const handleEdit = (activity: ActivityRecordWithId) => {
    setSelectedActivity(activity);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
        try {
            await deleteDoc(doc(db, 'actividades', id));
            toast({ title: "Éxito", description: "Actividad eliminada correctamente." });
            setData(prev => prev.filter(item => item.id !== id));
        } catch(error) {
            console.error("Error deleting activity:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la actividad." });
        }
    });
  };
  
  const columns = useMemo<ColumnDef<ActivityRecordWithId>[]>(() => [
    { header: 'Año', cell: ({ row }) => format(row.original.registerDate, 'yyyy')},
    { header: 'Mes', cell: ({ row }) => format(row.original.registerDate, 'LLL', { locale: es }).replace('.','') },
    { header: 'Dia', cell: ({ row }) => format(row.original.registerDate, 'E', { locale: es }).replace('.','') },
    { header: 'Sem.', cell: ({ row }) => getWeek(row.original.registerDate, { weekStartsOn: 1, locale: es })},
    { header: 'Fecha', cell: ({ row }) => format(row.original.registerDate, 'dd/MM/yyyy')},
    { header: 'PROYEC.', accessorKey: 'stage' },
    { header: 'CAMPAÑA', accessorKey: 'campaign' },
    { header: 'DDC', cell: ({ row }) => {
        const loteData = lotesMap.get(row.original.lote);
        if (loteData && loteData.fechaCianamida && isValid(loteData.fechaCianamida) && isValid(row.original.registerDate)) {
            return differenceInDays(row.original.registerDate, loteData.fechaCianamida);
        }
        return 'N/A';
    }},
    { header: 'var', cell: ({row}) => lotesMap.get(row.original.lote)?.variedad || 'N/A' },
    { header: 'Asistente', cell: ({ row }) => assistantMap.get(row.original.assistantDni)?.assistantName || row.original.assistantDni },
    { header: 'Cod Lote', accessorKey: 'lote' },
    { header: 'COD. LABOR', accessorKey: 'code' },
    { header: 'Labor', accessorKey: 'labor' },
    { header: 'JR presup.', cell: ({ row }) => {
        const loteKey = parseInt(row.original.lote, 10);
        const key = `${loteKey}-${row.original.labor}`;
        const presupuesto = presupuestoMap.get(key);
        return presupuesto ? presupuesto.jrnHa : '0';
    }},
    { header: 'JHU/Ha', cell: ({ row }) => {
        const cumulativeJrHa = cumulativeJrHaMap.get(row.original.id);
        return cumulativeJrHa !== undefined ? cumulativeJrHa.toFixed(2) : '0.00';
    }},
    { header: 'Saldo', cell: ({row}) => {
        const loteKey = parseInt(row.original.lote, 10);
        const key = `${loteKey}-${row.original.labor}`;
        const presupuesto = presupuestoMap.get(key);
        const jrPresup = presupuesto ? Number(presupuesto.jrnHa) : 0;
        
        const jhuHa = cumulativeJrHaMap.get(row.original.id) || 0;
        
        const saldo = jrPresup - jhuHa;
        
        const saldoClassName = saldo < 0 ? 'text-red-600 font-bold' : 'text-blue-600';
        
        return <span className={saldoClassName}>{saldo.toFixed(2)}</span>;
    }},
    { header: 'N° Pasada', accessorKey: 'pass' },
    { header: 'JR/Ha', cell: ({ row }) => {
        const totalHaProdForLote = loteHaProdMap.get(row.original.lote) || 0;
        if (totalHaProdForLote === 0) return '0.00';
        
        const jhu = row.original.workdayCount || 0;
        const result = jhu / totalHaProdForLote;
        return result.toFixed(2);
    }},
    { header: 'Rdto total', accessorKey: 'performance', cell: ({ row }) => row.original.performance?.toLocaleString('en-US') || '0' },
    { header: 'Area Avanzada', cell: ({row}) => {
      const loteData = lotesMap.get(row.original.lote);
      const densidad = loteData?.densidad || 0;
      const performance = row.original.performance || 0;
      if (densidad > 0) {
        return (performance / densidad).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return '0.00';
    }},
    { header: 'Racimo o jabas', cell: ({ row }) => row.original.clustersOrJabas?.toLocaleString('en-US') || '0' },
    { header: 'Min Estab.', cell: ({ row }) => {
        const { campaign, lote, code, pass } = row.original;
        const key = `${campaign}-${lote}-${code}-${pass}`;
        const record = minMaxMap.get(key);
        return record ? record.min : 'N/A';
    }},
    { header: 'Max Estab.', cell: ({ row }) => {
        const { campaign, lote, code, pass } = row.original;
        const key = `${campaign}-${lote}-${code}-${pass}`;
        const record = minMaxMap.get(key);
        return record ? record.max : 'N/A';
    }},
    { header: 'Min', accessorKey: 'minRange' },
    { header: 'Max', accessorKey: 'maxRange' },
    { header: 'Personas', accessorKey: 'personnelCount' },
    { header: 'JHU', accessorKey: 'workdayCount' },
    { header: 'Costo Plta, Jaba, Racimo', accessorKey: 'cost', cell: ({ row }) => `S/ ${row.original.cost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}` },
    { header: 'TURNO', accessorKey: 'shift' },
    { header: 'Prom./ Jhu', cell: ({ row }) => {
        const specialLabors = ['46', '67'];
        const isSpecial = specialLabors.includes(row.original.code || '');
        const numerator = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);
        const jhu = row.original.workdayCount || 0;
        if (jhu === 0) return '0.00';
        return (numerator / jhu).toFixed(2);
    } },
    { header: 'Prom./ Persona', cell: ({ row }) => {
        const specialLabors = ['46', '67'];
        const isSpecial = specialLabors.includes(row.original.code || '');
        const numerator = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);
        const personas = row.original.personnelCount || 0;
        if (personas === 0) return '0.00';
        return (numerator / personas).toFixed(2);
    } },
    { header: 'costo por planta', cell: ({ row }) => {
        const cost = row.original.cost || 0;
        const specialLabors = ['46', '67'];
        const isSpecial = specialLabors.includes(row.original.code || '');
        
        const numerator = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);
        const divisor = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);

        let costoLabor = 0;
        if (cost === 0) {
            costoLabor = (row.original.workdayCount || 0) * 60;
        } else {
            costoLabor = numerator * cost;
        }

        let costoPorUnidad = 0;
        if (divisor > 0) {
            costoPorUnidad = costoLabor / divisor;
        }
        return `S/ ${costoPorUnidad.toFixed(2)}`;
    } },
    { header: 'costo plta emp.', cell: ({ row }) => {
        const cost = row.original.cost || 0;
        const specialLabors = ['46', '67'];
        const isSpecial = specialLabors.includes(row.original.code || '');

        const numerator = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);
        const divisor = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);
        
        let costoLabor = 0;
        if (cost === 0) {
            costoLabor = (row.original.workdayCount || 0) * 60;
        } else {
            costoLabor = numerator * cost;
        }
        const costoEmpresa = costoLabor * 1.30;
        
        let costoUnidadEmp = 0;
        if (divisor > 0) {
            costoUnidadEmp = costoEmpresa / divisor;
        }
        return `S/ ${costoUnidadEmp.toFixed(2)}`;
    } },
    { header: 'Pago Neto Prom. / JHU', cell: ({ row }) => {
        const cost = row.original.cost || 0;
        let pagoNeto = 0;
        if (cost === 0) {
            pagoNeto = 60; // jornal
        } else {
            const specialLabors = ['46', '67'];
            const isSpecial = specialLabors.includes(row.original.code || '');
            const numerator = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);
            const jhu = row.original.workdayCount || 0;
            const promJhu = jhu > 0 ? numerator / jhu : 0;
            pagoNeto = promJhu * cost;
        }
        return `S/ ${pagoNeto.toFixed(2)}`;
    } },
    { header: 'Costo Labor', cell: ({ row }) => {
        const cost = row.original.cost || 0;
        const specialLabors = ['46', '67'];
        const isSpecial = specialLabors.includes(row.original.code || '');
        const numerator = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);

        let costoLabor = 0;
        if (cost === 0) {
            costoLabor = (row.original.workdayCount || 0) * 60;
        } else {
            costoLabor = numerator * cost;
        }
        return `S/ ${costoLabor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } },
    { header: 'Costo Empresa', cell: ({ row }) => {
        const cost = row.original.cost || 0;
        const specialLabors = ['46', '67'];
        const isSpecial = specialLabors.includes(row.original.code || '');
        const numerator = isSpecial ? (row.original.clustersOrJabas || 0) : (row.original.performance || 0);

        let costoLabor = 0;
        if (cost === 0) {
            costoLabor = (row.original.workdayCount || 0) * 60;
        } else {
            costoLabor = numerator * cost;
        }
        const costoEmpresa = costoLabor * 1.30;
        return `S/ ${costoEmpresa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } },
    { header: 'Obs.', accessorKey: 'observations' },
    { header: 'Usuario', cell: ({ row }) => userMap.get(row.original.createdBy)?.nombre || row.original.createdBy },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90">
                    <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará el registro permanentemente.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(row.original.id)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ], [userMap, lotesMap, loteHaProdMap, presupuestoMap, cumulativeJrHaMap, minMaxMap, assistantMap]);

  const filteredData = useMemo(() => {
    let filtered = data;

    if (globalFilter) {
      const lowerGlobalFilter = globalFilter.toLowerCase();
      filtered = filtered.filter(item =>
        item.labor?.toLowerCase().includes(lowerGlobalFilter) || 
        item.lote?.toLowerCase().includes(lowerGlobalFilter) ||
        item.campaign?.toLowerCase().includes(lowerGlobalFilter)
      );
    }
    
    if (activeFilters.campaign) {
      filtered = filtered.filter(item => item.campaign === activeFilters.campaign);
    }
    if (activeFilters.stage) {
      filtered = filtered.filter(item => item.stage === activeFilters.stage);
    }
    if (activeFilters.lote) {
      filtered = filtered.filter(item => item.lote === activeFilters.lote);
    }
    if (activeFilters.labor) {
      filtered = filtered.filter(item => item.labor === activeFilters.labor);
    }
    if (activeFilters.pass) {
      filtered = filtered.filter(item => String(item.pass) === activeFilters.pass);
    }
    if (activeFilters.dateRange?.from) {
        filtered = filtered.filter(item => item.registerDate >= startOfDay(activeFilters.dateRange!.from!));
    }
    if (activeFilters.dateRange?.to) {
        filtered = filtered.filter(item => item.registerDate <= startOfDay(activeFilters.dateRange!.to!));
    }

    return filtered;
  }, [data, globalFilter, activeFilters]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  
  const handleDownload = () => {
    const dataToExport = table.getRowModel().rows.map(row => {
      const { id, createdBy, ...rest } = row.original;
      return {
        Fecha: format(rest.registerDate, 'dd/MM/yyyy'),
        Campaña: rest.campaign,
        Etapa: rest.stage,
        Lote: rest.lote,
        'Cód.': rest.code,
        Labor: rest.labor,
        Rendimiento: rest.performance,
        '# Pers.': rest.personnelCount,
        '# Jorn.': rest.workdayCount,
        'Costo (S/)': rest.cost,
        Turno: rest.shift,
        Pasada: rest.pass,
        Min: rest.minRange,
        Max: rest.maxRange,
        Observaciones: rest.observations,
        Asistente: assistantMap.get(rest.assistantDni)?.assistantName || rest.assistantDni,
        Usuario: userMap.get(createdBy)?.nombre || createdBy,
      };
    });
    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Actividades");
    xlsx.writeFile(workbook, "BaseDeActividades.xlsx");
  };

  const filterOptions = useMemo(() => {
    const campaigns = [...new Set(data.map(item => item.campaign).filter(Boolean))];
    const stages = [...new Set(data.map(item => item.stage).filter(Boolean))];
    const lotes = [...new Set(data.map(item => item.lote).filter(Boolean))];
    const labors = [...new Set(data.map(item => item.labor).filter(Boolean))];
    const passes = [...new Set(data.map(item => String(item.pass)))];
    return { campaigns, stages, lotes, labors, passes };
  }, [data]);
  
  const handleApplyFilters = useCallback(() => {
    setActiveFilters(popoverFilters);
    setIsFilterOpen(false);
  }, [popoverFilters]);

  const handleClearFilters = useCallback(() => {
    const cleared = getInitialFilters();
    setPopoverFilters(cleared);
    setActiveFilters(cleared);
    setIsFilterOpen(false);
  }, []);
  
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <Input
                placeholder="Buscar por labor, lote, campaña..."
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="w-full sm:max-w-sm h-9"
            />
            <div className="flex items-center gap-2">
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9">
                            <Filter className="mr-2 h-4 w-4" />
                            Filtros Avanzados
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Filtros Avanzados</h4>
                            </div>
                             <div className="grid gap-2">
                                <Label>Campaña</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, campaign: v === 'all' ? '' : v}))} value={popoverFilters.campaign}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.campaigns.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                <Label>Etapa</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, stage: v === 'all' ? '' : v}))} value={popoverFilters.stage}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.stages.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                <Label>Lote</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, lote: v === 'all' ? '' : v}))} value={popoverFilters.lote}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{filterOptions.lotes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                <Label>Labor</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, labor: v === 'all' ? '' : v}))} value={popoverFilters.labor}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.labors.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                <Label>Pasada</Label>
                                <Select onValueChange={(v) => setPopoverFilters(p => ({...p, pass: v === 'all' ? '' : v}))} value={popoverFilters.pass}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{filterOptions.passes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                                <Label>Fecha</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="date" variant={'outline'} className={cn('w-full justify-start text-left font-normal h-9', !popoverFilters.dateRange?.from && 'text-muted-foreground' )}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {popoverFilters.dateRange?.from ? (popoverFilters.dateRange.to ? (<>{format(popoverFilters.dateRange.from, 'LLL dd, y', { locale: es })} - {format(popoverFilters.dateRange.to, 'LLL dd, y', { locale: es })}</>) : (format(popoverFilters.dateRange.from, 'LLL dd, y', { locale: es }))) : (<span>Seleccione un rango</span>)}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar initialFocus mode="range" defaultMonth={popoverFilters.dateRange?.from} selected={popoverFilters.dateRange} onSelect={(range) => setPopoverFilters(p => ({...p, dateRange: range}))} numberOfMonths={2} locale={es} />
                                    </PopoverContent>
                                </Popover>
                             </div>
                             <div className="flex justify-between items-center pt-2">
                                <Button variant="ghost" size="sm" onClick={handleClearFilters}>Limpiar</Button>
                                <Button size="sm" onClick={handleApplyFilters}>Aplicar</Button>
                             </div>
                        </div>
                    </PopoverContent>
                </Popover>
                <Button onClick={handleDownload} disabled={table.getRowModel().rows.length === 0} size="sm" className="h-9">
                    <FileDown className="h-4 w-4 mr-2" />
                    Descargar
                </Button>
            </div>
        </div>
        
        <div className="flex-1 rounded-lg border overflow-x-auto min-h-0">
          <Table>
              <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="whitespace-nowrap px-3 py-2 text-xs">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                  ))}
                  </TableRow>
              ))}
              </TableHeader>
              <TableBody>
              {(loading || masterLoading) ? (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
              ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>{row.getVisibleCells().map((cell) => (<TableCell key={cell.id} className="whitespace-nowrap px-3 py-2 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>
                  ))
              ) : (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No se encontraron registros.</TableCell></TableRow>
              )}
              </TableBody>
          </Table>
        </div>
  
        <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                  Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
              </span>
            <div className="flex items-center gap-2">
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
              >
                  <ChevronLeft className="h-4 w-4 mr-1"/>
                  Anterior
              </Button>
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
              >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1"/>
              </Button>
            </div>
        </div>
         {selectedActivity && (
              <EditActivityDialog
                  isOpen={isEditDialogOpen}
                  onOpenChange={setIsEditDialogOpen}
                  activity={selectedActivity}
                  onSuccess={() => {
                      setIsEditDialogOpen(false);
                      setSelectedActivity(null);
                      fetchData();
                  }}
              />
          )}
      </div>
    );
  }

    
