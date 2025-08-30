"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config");
// Função para criar cliente Supabase com token
function createSupabaseForToken(accessToken) {
    return (0, supabase_js_1.createClient)(config_1.SUPABASE_URL, config_1.SUPABASE_ANON_KEY, {
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
    });
}
// Função para extrair usuário do request
async function getUserFromRequest(req) {
    const bearer = req.headers.authorization?.replace('Bearer ', '');
    const cookieToken = req.cookies?.[config_1.COOKIE_ACCESS];
    const accessToken = bearer || cookieToken;
    if (!accessToken) {
        return { user: null, client: createSupabaseForToken(null) };
    }
    const client = createSupabaseForToken(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (error) {
        return { user: null, client };
    }
    return { user: data.user, client };
}
// Middleware de autenticação
async function requireAuth(req, res, next) {
    const { user, client } = await getUserFromRequest(req);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // Buscar perfil com company_id
    const { data: profile, error } = await client
        .from('users')
        .select('id, company_id, name, email, role, status')
        .eq('auth_user_id', user.id)
        .single();
    if (error || !profile) {
        return res.status(401).json({ error: 'User profile not found' });
    }
    if (profile.status !== 'active') {
        return res.status(403).json({ error: 'User account is not active' });
    }
    // Injetar user info e cliente Supabase no request
    ;
    req.user = {
        auth_user_id: user.id,
        company_id: profile.company_id,
        role: profile.role,
        profile_id: profile.id,
        name: profile.name,
        email: profile.email
    };
    req.supabase = client;
    next();
}
