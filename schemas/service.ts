import { z } from 'zod'
import { baseSchema, commonFields } from './base'

export const serviceSchema = baseSchema.extend({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  duration: z.number().int().min(15).max(480), // duração em minutos (max 8h)
  price: z.number().min(0),
  active: z.boolean().default(true),
  ...commonFields
})

export const serviceCreateSchema = serviceSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
})

export const serviceUpdateSchema = serviceCreateSchema.partial()

export type Service = z.infer<typeof serviceSchema>
export type ServiceCreate = z.infer<typeof serviceCreateSchema>
export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>
