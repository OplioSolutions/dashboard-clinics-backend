import { User, SupabaseClient } from '@supabase/supabase-js'

declare global {
  namespace Express {
    interface Request {
      user?: {
        auth_user_id: string
        company_id: string
        role: 'admin' | 'staff'
        profile_id: string
        name: string
        email: string
      }
      tenant?: {
        company_id: string
      }
      supabase?: SupabaseClient
      integration?: {
        companyId: string
        channel: string
        credentials: {
          webhookSecret: string
          apiKey?: string
        }
      }
    }
  }
}