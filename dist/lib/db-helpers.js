"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTenantFilter = withTenantFilter;
exports.createTenantScopedQuery = createTenantScopedQuery;
exports.getSupabaseClient = getSupabaseClient;
const supabase_js_1 = require("@supabase/supabase-js");
function withTenantFilter(query, company_id) {
    return query.eq('company_id', company_id);
}
// Helper para criar queries com escopo de tenant
function createTenantScopedQuery(supabase, table, company_id) {
    return withTenantFilter(supabase.from(table), company_id);
}
/**
 * Cria instância do cliente Supabase para uso interno
 * Usado pelos services e controllers quando não há req.supabase disponível
 */
function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    }
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
}
// Exemplo de uso:
// const query = createTenantScopedQuery(supabase, 'clients', req.tenant.company_id)
// const { data, error } = await query.select('*')
