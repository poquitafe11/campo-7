
import { z } from "zod";

// Production Tracking
export const ProductionSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  harvestDate: z.date(),
  yieldAmount: z.number().positive(),
  plantingDate: z.date(),
  cropType: z.string().min(1, "Crop type is required"),
});
export type ProductionData = z.infer<typeof ProductionSchema>;

// Health Management
export const HealthSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  observationDate: z.date(),
  disease: z.string().min(1, "Disease/pest name is required"),
  treatment: z.string().min(1, "Treatment is required"),
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
  color: z.string().min(1, "Color is required"),
});
export type QualityControlData = z.infer<typeof QualityControlSchema>;

// Biological Control
export const BiologicalControlSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  releaseDate: z.date(),
  agent: z.string().min(1, "Agent name is required"),
  quantity: z.number().positive(),
  targetPest: z.string().min(1, "Target pest is required"),
});
export type BiologicalControlData = z.infer<typeof BiologicalControlSchema>;

// AI Query
export const QuerySchema = z.object({
  query: z.string().min(10, "Please enter a more detailed query."),
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
export type Assistant = {
  id: string;
  assistantName: string;
  personnelCount: number;
  absentCount: number;
};

export type Labor = {
  codigo: string;
  descripcion: string;
};

export type LoteData = {
  id: string;
  lote: string;
  cuartel: string;
  variedad: string;
  ha: number;
  densidad: number;
  haProd: number;
  plantasTotal: number;
  plantasProd: number;
  fechaCianamida: Date;
  campana: string;
};

export type AttendanceRecord = {
  id: string;
  date: string;
  lotName: string;
  variedad: string;
  fechaCianamida: Date;
  campana: string;
  code?: string;
  labor: string;
  assistants: Assistant[];
  totals: {
    personnelCount: number;
    absentCount: number;
  };
  registeredBy: string | null;
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
    performance: z.coerce.number(),
    personnelCount: z.coerce.number().int().min(1, "Debe haber al menos una persona."),
    workdayCount: z.coerce.number(),
    cost: z.coerce.number(),
    shift: z.string().min(1, "El turno es requerido."),
    minRange: z.coerce.number(),
    maxRange: z.coerce.number(),
    pass: z.coerce.number(),
    observations: z.string().optional(),
    createdBy: z.string().email("Debe ser un email válido."),
});
export type ActivityRecordData = z.infer<typeof ActivityRecordSchema>;

export const PresupuestoSchema = z.object({
  id: z.string(),
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
