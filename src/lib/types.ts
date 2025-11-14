

import { z } from "zod";

// Production Tracking
export const ProductionSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  harvestDate: z.date(),
  yieldAmount: z.number().positive(),
  plantingDate: z.date(),
  cropType: z.string().min(1, "El tipo de cultivo es requerido"),
});
export type ProductionData = z.infer<typeof ProductionSchema>;

// Health Management
export const HealthSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  observationDate: z.date(),
  disease: z.string().min(1, "El nombre de la plaga/enfermedad es requerido"),
  treatment: z.string().min(1, "El tratamiento es requerido"),
  notes: z.string().optional(),
});
export type HealthData = z.infer<typeof HealthSchema>;

// Irrigation Monitoring
export const IrrigationSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  irrigationDate: z.date(),
  waterAmount: z.number().positive(),
  durationMinutes: z.number().positive(),
});
export type IrrigationData = z.infer<typeof IrrigationSchema>;

// Quality Control
export const QualityControlSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  sampleDate: z.date(),
  brix: z.number().min(0),
  firmness: z.number().min(0),
  color: z.string().min(1, "El color es requerido"),
});
export type QualityControlData = z.infer<typeof QualityControlSchema>;

// Biological Control
export const BiologicalControlSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  releaseDate: z.date(),
  agent: z.string().min(1, "El nombre del agente es requerido"),
  quantity: z.number().positive(),
  targetPest: z.string().min(1, "La plaga objetivo es requerida"),
});
export type BiologicalControlData = z.infer<typeof BiologicalControlSchema>;

// AI Query
export const QuerySchema = z.object({
  query: z.string().min(10, "Por favor, introduce una consulta más detallada."),
});
export type QueryData = z.infer<typeof QuerySchema>;

export interface AppState {
  production: ProductionData[];
  health: HealthData[];
  irrigation: IrrigationData[];
  qualityControl: QualityControlData[];
  biologicalControl: BiologicalControlData[];
}

// Asistencia
export const JaladorAttendanceSchema = z.object({
  id: z.string(),
  jaladorId: z.string(),
  jaladorAlias: z.string(),
  personnelCount: z.number().int().min(0),
  absentCount: z.number().int().min(0),
  supportedLabor: z.string().optional(),
});
export type JaladorAttendance = z.infer<typeof JaladorAttendanceSchema>;

export const AssistantSchema = z.object({
  id: z.string(),
  assistantDni: z.string(),
  assistantName: z.string(),
  jaladores: z.array(JaladorAttendanceSchema),
  personnelCount: z.number().optional(),
  absentCount: z.number().optional(),
});
export type Assistant = z.infer<typeof AssistantSchema>;

export type Labor = {
  codigo: string;
  descripcion: string;
};

export const LoteDataSchema = z.object({
  id: z.string(),
  lote: z.string(),
  cuartel: z.string(),
  variedad: z.string(),
  ha: z.number(),
  densidad: z.number(),
  haProd: z.number(),
  plantasTotal: z.number(),
  plantasProd: z.number(),
  fechaCianamida: z.union([z.date(), z.string()]),
  campana: z.string(),
});
export type LoteData = z.infer<typeof LoteDataSchema>;


export type AttendanceRecord = {
  id?: string;
  date: string;
  lote: string; 
  lotName?: string;
  turno: string;
  variedad: string;
  fechaCianamida?: Date;
  campana: string;
  code?: string;
  labor: string;
  assistants: Assistant[];
  totals: {
    personnelCount: number;
    absentCount: number;
  };
  registeredBy: string | null | undefined;
  createdAt?: any;
  lastModifiedBy?: string | null;
  lastModifiedAt?: any;
};

export type SummaryData = {
  date: string;
  dateFull: string;
  Personal: number;
  Faltas: number;
};

export type MinMax = {
  id: string;
  campana: string;
  lote: string;
  codigo: string;
  labor: string;
  pasada: number;
  min: number;
  max: number;
};

// Jaladores
export const JaladorSchema = z.object({
  id: z.string(),
  dni: z.string().optional().or(z.literal('')),
  nombre: z.string().optional(),
  alias: z.string().min(1, "El alias es requerido."),
  celular: z.string().optional().or(z.literal('')),
});
export type Jalador = z.infer<typeof JaladorSchema>;


// Usuarios del sistema
export const UserRole = z.enum(["Admin", "Jefe", "Supervisor", "Asistente", "Apoyo", "Invitado"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserSchema = z.object({
  nombre: z.string().min(3, "El nombre es requerido."),
  dni: z.string().min(8, "El DNI debe tener 8 dígitos.").max(8, "El DNI debe tener 8 dígitos."),
  celular: z.string().min(9, "El celular debe tener 9 dígitos.").max(9, "El celular debe tener 9 dígitos."),
  email: z.string().email("El email no es válido."),
  rol: UserRole,
  active: z.boolean().default(true),
  fotoURL: z.string().url().optional(),
  permissions: z.record(z.boolean()).optional(),
});

export const NewUserSchema = UserSchema.extend({
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export type User = z.infer<typeof UserSchema>;
export type NewUser = z.infer<typeof NewUserSchema>;


// Registro de Actividades (Parte Diario)
export const ActivityRecordSchema = z.object({
    registerDate: z.date({required_error: "La fecha es requerida."}),
    campaign: z.string().min(1, "La campaña es requerida."),
    stage: z.string().min(1, "La etapa es requerida."),
    lote: z.string().min(1, "El lote es requerido."),
    code: z.string().optional(),
    labor: z.string().optional(),
    performance: z.coerce.number().min(0, "El rendimiento debe ser un número no negativo."),
    clustersOrJabas: z.coerce.number().optional(),
    personnelCount: z.coerce.number().int().min(1, "Debe haber al menos una persona."),
    workdayCount: z.coerce.number().min(0, "Las jornadas deben ser un número no negativo."),
    cost: z.coerce.number().min(0, "El costo debe ser un número no negativo."),
    shift: z.string().min(1, "El turno es requerido."),
    minRange: z.coerce.number(),
    maxRange: z.coerce.number(),
    pass: z.coerce.number(),
    observations: z.string().optional(),
    assistantDni: z.string().min(1, "El DNI del asistente es requerido."),
    assistantName: z.string().optional(), // Now optional as it can be fetched
    createdBy: z.string().min(1, "No se pudo identificar al creador del registro."),
});
export type ActivityRecordData = z.infer<typeof ActivityRecordSchema>;

export const PresupuestoSchema = z.object({
  id: z.string(),
  campana: z.string(),
  descripcionLabor: z.string(),
  lote: z.string(),
  jornadas: z.number(),
  jrnHa: z.number(),
});
export type Presupuesto = z.infer<typeof PresupuestoSchema>;

// Maestro de Trabajadores
export const WorkerMasterSchema = z.object({
  dni: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkerMasterItem = z.infer<typeof WorkerMasterSchema>;


// Fenologia
export const chargerBudsSchema = z.object({
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

export const BudbreakSchema = z.object({
  evaluationMethod: z.enum(['random', 'tracking']),
  plantNumber: z.coerce.number().int().positive().optional(),
  totalBuds: z.coerce.number().min(0, "Debe ser positivo."),
  swollenBuds: z.coerce.number().min(0, "Debe ser positivo."),
  cottonBuds: z.coerce.number().min(0, "Debe ser positivo."),
  greenTipBuds: z.coerce.number().min(0, "Debe ser positivo."),
  unfoldedLeaves: z.coerce.number().min(0, "Debe ser positivo."),
});

export const PhenologySchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  date: z.date({ required_error: 'La fecha es obligatoria.' }),
  lote: z.string().min(1, 'El lote es requerido.'),
  cuartel: z.string().min(1, 'El cuartel es requerido.'),
  evaluationType: z.string().min(1, 'Debe seleccionar un tipo de evaluación.'),
  pass: z.coerce.number().int().min(1, 'La pasada debe ser al menos 1.'),
  chargerBuds: chargerBudsSchema.optional(),
  budbreak: BudbreakSchema.optional(),
  createdBy: z.string().email(),
  createdAt: z.date(),
});
export type PhenologyData = z.infer<typeof PhenologySchema>;

    
