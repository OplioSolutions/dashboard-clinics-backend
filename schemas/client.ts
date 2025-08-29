import { z } from 'zod'
import { baseSchema, phoneRegex, commonFields } from './base'

export const clientSchema = baseSchema.extend({
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  phone: z.string().regex(phoneRegex, 'Invalid phone number format').optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  address: z.string().max(200).optional(),
  ...commonFields
})

export const clientCreateSchema = clientSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
})

export const clientUpdateSchema = clientCreateSchema.partial()

export type Client = z.infer<typeof clientSchema>
export type ClientCreate = z.infer<typeof clientCreateSchema>
export type ClientUpdate = z.infer<typeof clientUpdateSchema>
