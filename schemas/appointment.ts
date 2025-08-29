import { z } from 'zod'
import { baseSchema, commonFields } from './base'

export const appointmentSchema = baseSchema.extend({
  client_id: z.string().uuid(),
  service_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  ended_at: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).default('scheduled'),
  ...commonFields
})

export const appointmentCreateSchema = appointmentSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  ended_at: true
})

export const appointmentUpdateSchema = appointmentCreateSchema.partial()

export type Appointment = z.infer<typeof appointmentSchema>
export type AppointmentCreate = z.infer<typeof appointmentCreateSchema>
export type AppointmentUpdate = z.infer<typeof appointmentUpdateSchema>
