
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import apiRoutes from './routes'
import { webhookRoutes } from './routes/webhook.routes'
import { requireAuth } from './middleware/auth'
import { handleError } from './lib/errors'

const app = express()

// Configurações básicas
app.use(express.json())
app.use(cookieParser())
app.use(
  cors({
    origin: true,
    credentials: true,
  })
)

// Configuração do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment')
}

const COOKIE_ACCESS = 'sb-access-token'
const COOKIE_REFRESH = 'sb-refresh-token'

function setAuthCookies(res: express.Response, accessToken: string, refreshToken: string) {
  const secure = process.env.NODE_ENV === 'production'
  const common = { httpOnly: true as const, sameSite: 'lax' as const, secure }
  res.cookie(COOKIE_ACCESS, accessToken, { ...common, maxAge: 1000 * 60 * 60 * 6 }) // 6 horas
  res.cookie(COOKIE_REFRESH, refreshToken, { ...common, maxAge: 1000 * 60 * 60 * 24 * 7 }) // 7 dias
}

function clearAuthCookies(res: express.Response) {
  res.clearCookie(COOKIE_ACCESS, { httpOnly: true, sameSite: 'lax' })
  res.clearCookie(COOKIE_REFRESH, { httpOnly: true, sameSite: 'lax' })
}

// Rotas de autenticação (públicas)
app.post('/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const root = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string)
    const { data, error } = await root.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      return res.status(401).json({ error: error?.message || 'Invalid credentials' })
    }

    const { access_token, refresh_token, user } = data.session

    // Buscar profile do usuário
    const { data: profiles, error: profileError } = await root
      .from('users')
      .select('id, company_id, name, email, role, status')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !profiles) {
      return res.status(401).json({ error: 'User profile not found' })
    }

    if (profiles.status !== 'active') {
      return res.status(403).json({ error: 'User account is not active' })
    }

    setAuthCookies(res, access_token, refresh_token)
    return res.status(200).json({
      user: { id: user.id, email: user.email },
      profile: profiles
    })
  } catch (error) {
    return handleError(error, res)
  }
})

app.post('/auth/signout', async (_req, res) => {
  clearAuthCookies(res)
  return res.status(200).json({ ok: true })
})

// Rota de verificação de autenticação
app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    return res.status(200).json({
      user: {
        id: (req as any).user?.auth_user_id,
        email: (req as any).user?.email
      },
      profile: {
        id: (req as any).user?.profile_id,
        company_id: (req as any).user?.company_id,
        name: (req as any).user?.name,
        email: (req as any).user?.email,
        role: (req as any).user?.role,
        status: 'active'
      }
    })
  } catch (error) {
    return handleError(error, res)
  }
})

// Rotas de webhook (públicas, mas com autenticação própria)
app.use('/webhooks', webhookRoutes)

// Rotas da API (protegidas)
app.use('/api', apiRoutes)

// Error handling global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  handleError(err, res)
})

const PORT = Number(process.env.PORT || 8787)
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})