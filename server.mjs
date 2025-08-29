import { config as loadEnv } from 'dotenv'
// Load default .env then override with .env.local if present
loadEnv()
loadEnv({ path: '.env.local', override: true })
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use(
  cors({
    origin: true,
    credentials: true,
  })
)

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment')
}

const COOKIE_ACCESS = 'sb-access-token'
const COOKIE_REFRESH = 'sb-refresh-token'

function createSupabaseForToken(accessToken) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  })
  return client
}

async function getUserFromRequest(req) {
  const bearer = req.headers.authorization?.replace('Bearer ', '')
  const cookieToken = req.cookies?.[COOKIE_ACCESS]
  const accessToken = bearer || cookieToken
  if (!accessToken) return { user: null, client: createSupabaseForToken(null) }
  const client = createSupabaseForToken(accessToken)
  const { data, error } = await client.auth.getUser(accessToken)
  if (error) return { user: null, client }
  return { user: data.user, client }
}

// Middleware de autenticação
async function requireAuth(req, res, next) {
  const { user, client } = await getUserFromRequest(req)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  // Buscar perfil do usuário
  const { data: profiles, error } = await client
    .from('users')
    .select('id, company_id, name, email, role, status')
    .eq('auth_user_id', user.id)
    .limit(1)
  
  if (error || !profiles?.[0]) {
    return res.status(401).json({ error: 'User profile not found' })
  }
  
  const profile = profiles[0]
  if (profile.status !== 'active') {
    return res.status(403).json({ error: 'User account is not active' })
  }
  
  // Injeta req.user com dados do usuário autenticado
  req.user = {
    auth_user_id: user.id,
    company_id: profile.company_id,
    role: profile.role,
    name: profile.name,
    email: profile.email,
    profile_id: profile.id
  }
  
  next()
}

// Middleware de escopo por tenant
function withTenantScope(req, res, next) {
  if (!req.user?.company_id) {
    return res.status(403).json({ error: 'Company scope not available' })
  }
  next()
}

// Helper para consultas com filtro obrigatório por company_id
function withCompanyFilter(queryBuilder, companyId) {
  return queryBuilder.eq('company_id', companyId)
}

function setAuthCookies(res, accessToken, refreshToken) {
  const secure = process.env.NODE_ENV === 'production'
  const common = { httpOnly: true, sameSite: 'lax', secure }
  res.cookie(COOKIE_ACCESS, accessToken, { ...common, maxAge: 1000 * 60 * 60 * 6 })
  res.cookie(COOKIE_REFRESH, refreshToken, { ...common, maxAge: 1000 * 60 * 60 * 24 * 7 })
}

function clearAuthCookies(res) {
  res.clearCookie(COOKIE_ACCESS, { httpOnly: true, sameSite: 'lax' })
  res.clearCookie(COOKIE_REFRESH, { httpOnly: true, sameSite: 'lax' })
}

// Routes
app.post('/auth/signin', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  
  const root = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await root.auth.signInWithPassword({ email, password })
  
  if (error || !data.session) return res.status(401).json({ error: error?.message || 'Invalid credentials' })
  
  const { access_token, refresh_token, user } = data.session
  
  // DEBUG: Log do user.id que vem do Supabase
  console.log('🔍 DEBUG: User ID from Supabase:', user.id)
  console.log('🔍 DEBUG: User email from Supabase:', user.email)
  
  // Buscar profile do usuário por auth_user_id
  const { data: profiles, error: profileError } = await root
    .from('users')
    .select('id, company_id, name, email, role, status')
    .eq('auth_user_id', user.id)
    .single()
  
  // DEBUG: Log da consulta
  console.log('🔍 DEBUG: Query result:', { profiles, profileError })
  
  if (profileError || !profiles) {
    return res.status(401).json({ error: 'User profile not found' })
  }
  
  const profile = profiles
  if (profile.status !== 'active') {
    return res.status(403).json({ error: 'User account is not active' })
  }
  
  setAuthCookies(res, access_token, refresh_token)
  
  return res.status(200).json({ 
    user: { id: user.id, email: user.email },
    profile: {
      id: profile.id,
      company_id: profile.company_id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      status: profile.status
    }
  })
})

app.post('/auth/signout', async (_req, res) => {
  clearAuthCookies(res)
  return res.status(200).json({ ok: true })
})

// Rota protegida que usa o middleware
app.get('/auth/me', requireAuth, (req, res) => {
  return res.status(200).json({ 
    user: { 
      id: req.user.auth_user_id, 
      email: req.user.email 
    }, 
    profile: {
      id: req.user.profile_id,
      company_id: req.user.company_id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: 'active'
    }
  })
})

// Exemplo de rota protegida com escopo de tenant
app.get('/api/profile', requireAuth, withTenantScope, (req, res) => {
  return res.status(200).json({ 
    message: 'Profile accessed successfully',
    user: req.user,
    company_id: req.user.company_id
  })
})

const PORT = Number(process.env.PORT || 8787)
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})


