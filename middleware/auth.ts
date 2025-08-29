import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, COOKIE_ACCESS } from '../config'

// Função para criar cliente Supabase com token
function createSupabaseForToken(accessToken?: string | null) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`
      } : undefined
    }
  })
}

// Função para extrair usuário do request
async function getUserFromRequest(req: Request) {
  const bearer = req.headers.authorization?.replace('Bearer ', '')
  const cookieToken = req.cookies?.[COOKIE_ACCESS]
  const accessToken = bearer || cookieToken
  
  if (!accessToken) {
    return { user: null, client: createSupabaseForToken(null) }
  }
  
  const client = createSupabaseForToken(accessToken)
  const { data, error } = await client.auth.getUser(accessToken)
  
  if (error) {
    return { user: null, client }
  }
  
  return { user: data.user, client }
}

// Middleware de autenticação
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { user, client } = await getUserFromRequest(req)
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  // Buscar perfil com company_id
  const { data: profile, error } = await client
    .from('users')
    .select('id, company_id, name, email, role, status')
    .eq('auth_user_id', user.id)
    .single()
  
  if (error || !profile) {
    return res.status(401).json({ error: 'User profile not found' })
  }
  
  if (profile.status !== 'active') {
    return res.status(403).json({ error: 'User account is not active' })
  }
  
  // Injetar user info e cliente Supabase no request
  ;(req as any).user = {
    auth_user_id: user.id,
    company_id: profile.company_id,
    role: profile.role,
    profile_id: profile.id,
    name: profile.name,
    email: profile.email
  }
  
  ;(req as any).supabase = client
  
  next()
}