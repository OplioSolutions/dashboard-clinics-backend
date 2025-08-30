"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const supabase_js_1 = require("@supabase/supabase-js");
const routes_1 = __importDefault(require("./routes"));
const webhook_routes_1 = require("./routes/webhook.routes");
const auth_1 = require("./middleware/auth");
const errors_1 = require("./lib/errors");
const app = (0, express_1.default)();
// Configurações básicas
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
// Configuração do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
}
const COOKIE_ACCESS = 'sb-access-token';
const COOKIE_REFRESH = 'sb-refresh-token';
function setAuthCookies(res, accessToken, refreshToken) {
    const secure = process.env.NODE_ENV === 'production';
    const common = { httpOnly: true, sameSite: 'lax', secure };
    res.cookie(COOKIE_ACCESS, accessToken, { ...common, maxAge: 1000 * 60 * 60 * 6 }); // 6 horas
    res.cookie(COOKIE_REFRESH, refreshToken, { ...common, maxAge: 1000 * 60 * 60 * 24 * 7 }); // 7 dias
}
function clearAuthCookies(res) {
    res.clearCookie(COOKIE_ACCESS, { httpOnly: true, sameSite: 'lax' });
    res.clearCookie(COOKIE_REFRESH, { httpOnly: true, sameSite: 'lax' });
}
// Rotas de autenticação (públicas)
app.post('/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const root = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data, error } = await root.auth.signInWithPassword({ email, password });
        if (error || !data.session) {
            return res.status(401).json({ error: error?.message || 'Invalid credentials' });
        }
        const { access_token, refresh_token, user } = data.session;
        // Buscar profile do usuário
        const { data: profiles, error: profileError } = await root
            .from('users')
            .select('id, company_id, name, email, role, status')
            .eq('auth_user_id', user.id)
            .single();
        if (profileError || !profiles) {
            return res.status(401).json({ error: 'User profile not found' });
        }
        if (profiles.status !== 'active') {
            return res.status(403).json({ error: 'User account is not active' });
        }
        setAuthCookies(res, access_token, refresh_token);
        return res.status(200).json({
            user: { id: user.id, email: user.email },
            profile: profiles
        });
    }
    catch (error) {
        return (0, errors_1.handleError)(error, res);
    }
});
app.post('/auth/signout', async (_req, res) => {
    clearAuthCookies(res);
    return res.status(200).json({ ok: true });
});
// Rota de verificação de autenticação
app.get('/auth/me', auth_1.requireAuth, async (req, res) => {
    try {
        return res.status(200).json({
            user: {
                id: req.user?.auth_user_id,
                email: req.user?.email
            },
            profile: {
                id: req.user?.profile_id,
                company_id: req.user?.company_id,
                name: req.user?.name,
                email: req.user?.email,
                role: req.user?.role,
                status: 'active'
            }
        });
    }
    catch (error) {
        return (0, errors_1.handleError)(error, res);
    }
});
// Rotas de webhook (públicas, mas com autenticação própria)
app.use('/webhooks', webhook_routes_1.webhookRoutes);
// Rotas da API (protegidas)
app.use('/api', routes_1.default);
// Error handling global
app.use((err, req, res, next) => {
    (0, errors_1.handleError)(err, res);
});
const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
});
