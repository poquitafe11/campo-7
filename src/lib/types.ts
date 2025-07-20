
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
  lote: string;
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
});

export type User = z.infer<typeof UserSchema>;
