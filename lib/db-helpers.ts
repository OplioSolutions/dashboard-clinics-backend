import { SupabaseClient, createClient } from '@supabase/supabase-js'

export function withTenantFilter(
  query: any,
  company_id: string
) {
  return query.eq('company_id', company_id)
}

// Helper para criar queries com escopo de tenant
export function createTenantScopedQuery(
  supabase: SupabaseClient,
  table: string,
  company_id: string
) {
  return withTenantFilter(supabase.from(table), company_id)
}

/**
 * Cria instância do cliente Supabase para uso interno
 * Usado pelos services e controllers quando não há req.supabase disponível
 */
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }

  return createClient(supabaseUrl, supabaseKey)
}

// Exemplo de uso:
// const query = createTenantScopedQuery(supabase, 'clients', req.tenant.company_id)
// const { data, error } = await query.select('*')
