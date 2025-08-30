"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOKIE_REFRESH = exports.COOKIE_ACCESS = exports.SUPABASE_ANON_KEY = exports.SUPABASE_URL = void 0;
exports.SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
exports.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
exports.COOKIE_ACCESS = 'sb-access-token';
exports.COOKIE_REFRESH = 'sb-refresh-token';
if (!exports.SUPABASE_URL || !exports.SUPABASE_ANON_KEY) {
    console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
}
