import { z } from 'zod'

export const baseSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
})

// Tipos comuns
export const phoneRegex = /^\+?[1-9]\d{1,14}$/

export const commonFields = {
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional()
}
