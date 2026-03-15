
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { WorkerMasterItem } from '@/lib/types';
import { Users, UserPlus, Search, Edit, Trash2, KeyRound, UserCircle, Loader2, FileUp, FileText, UploadCloud, Download, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useHeaderActions } from '@/contexts/HeaderActionsContext';

const BATCH_SIZE = 450;

export default function WorkerMasterManagement() {
  const { toast } = useToast();
  const [workerMaster, setWorkerMaster] = useState<WorkerMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { setActions } = useHeaderActions();

  const [searchTerm, setSearchTerm] = useState('');
  const [workerToDelete, setWorkerToDelete] = useState<WorkerMasterItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActions({ title: 'Maestro de Trabajadores' });
    return () => setActions({});
  }, [setActions]);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "maestro-trabajadores"), (snapshot) => {
        const workers = snapshot.docs.map(doc => doc.data() as WorkerMasterItem);
        setWorkerMaster(workers);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching worker master data: ", error);
        toast({ title: "Error de Carga", description: "No se pudieron obtener los datos.", variant: "destructive" });
        setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);

  const handleProcessFile = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

      let dataToProcess = json;
      if (json.length > 0) {
          const firstRow = json[0];
          if (String(firstRow[0]).toLowerCase().includes('dni')) dataToProcess = json.slice(1);
      }

      const newWorkers = dataToProcess.map(row => {
          const dni = String(row[0] || '').trim();
          const name = String(row[1] || '').trim();
          if (!dni || !name || !/^\d{8}$/.test(dni)) return null;
          return { dni, name };
      }).filter((w): w is { dni: string, name: string } => w !== null);

      if (newWorkers.length === 0) throw new Error("No hay datos válidos.");

      // Split into batches of 450 to avoid Firestore 500 limit
      for (let i = 0; i < newWorkers.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          const chunk = newWorkers.slice(i, i + BATCH_SIZE);
          chunk.forEach(worker => {
              const docRef = doc(db, "maestro-trabajadores", worker.dni);
              batch.set(docRef, { 
                ...worker, 
                updatedAt: new Date().toISOString() 
              }, { merge: true });
          });
          await batch.commit();
      }

      toast({ title: "Carga Exitosa", description: `${newWorkers.length} registros procesados.` });
      setSelectedFile(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredWorkers = useMemo(() => {
    const low = searchTerm.toLowerCase();
    return workerMaster.filter(w => w.name.toLowerCase().includes(low) || w.dni.includes(low));
  }, [workerMaster, searchTerm]);

  return (
    <div className="space-y-8 p-4">
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl font-headline text-center">Carga Masiva de Trabajadores</CardTitle>
          <CardDescription className="text-center">Seleccione un archivo Excel/CSV (Columna A: DNI, Columna B: Nombre).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" ref={fileInputRef} accept=".csv, .xls, .xlsx" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full" disabled={isProcessing}>
            <FileUp className="mr-2 h-4 w-4" /> Seleccionar Archivo
          </Button>
          {selectedFile && <div className="text-sm p-2 border rounded bg-muted/50 font-medium">Archivo: {selectedFile.name}</div>}
        </CardContent>
        <CardFooter>
          <Button onClick={handleProcessFile} className="w-full h-12 text-lg" disabled={!selectedFile || isProcessing}>
            {isProcessing ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <UploadCloud className="h-5 w-5 mr-2"/>}
            {isProcessing ? 'Procesando registros...' : 'Subir a la Base de Datos'}
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle className="text-2xl font-headline flex items-center"><Users className="mr-2 h-6 w-6 text-primary" /> Lista de Trabajadores</CardTitle>
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por DNI o nombre..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <ScrollArea className="h-[400px]">
                <Table>
                <TableHeader><TableRow><TableHead>DNI</TableHead><TableHead>Nombre</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary"/></TableCell></TableRow>
                    ) : filteredWorkers.length > 0 ? (
                        filteredWorkers.map(w => (
                            <TableRow key={w.dni}><TableCell className="font-mono">{w.dni}</TableCell><TableCell>{w.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => { setWorkerToDelete(w); }}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">No se encontraron trabajadores.</TableCell></TableRow>
                    )}
                </TableBody>
                </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!workerToDelete} onOpenChange={o => !o && setWorkerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar trabajador?</AlertDialogTitle><AlertDialogDescription>¿Estás seguro de eliminar a <strong>{workerToDelete?.name}</strong>? Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if(workerToDelete) await deleteDoc(doc(db, "maestro-trabajadores", workerToDelete.dni)); setWorkerToDelete(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar permanentemente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
