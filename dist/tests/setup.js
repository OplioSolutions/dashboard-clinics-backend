"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockResponse = exports.createMockRequest = exports.mockSupabaseClient = exports.createMockQueryBuilder = void 0;
// Configurar variáveis de ambiente para teste
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
process.env.NODE_ENV = 'test';
// Mock do cliente Supabase para testes
const createMockQueryBuilder = () => {
    const mockBuilder = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        containedBy: jest.fn().mockReturnThis(),
        rangeLt: jest.fn().mockReturnThis(),
        rangeGt: jest.fn().mockReturnThis(),
        rangeGte: jest.fn().mockReturnThis(),
        rangeLte: jest.fn().mockReturnThis(),
        rangeAdjacent: jest.fn().mockReturnThis(),
        overlaps: jest.fn().mockReturnThis(),
        textSearch: jest.fn().mockReturnThis(),
        match: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockReturnThis()
    };
    return mockBuilder;
};
exports.createMockQueryBuilder = createMockQueryBuilder;
// Mock do cliente Supabase
exports.mockSupabaseClient = {
    from: jest.fn().mockImplementation(() => (0, exports.createMockQueryBuilder)()),
    auth: {
        getUser: jest.fn()
    },
    supabaseUrl: 'http://localhost:54321',
    supabaseKey: 'test-key',
    realtime: {},
    storage: {},
    schema: {},
    rest: {},
    functions: {},
    channel: jest.fn(),
    getChannels: jest.fn(),
    removeChannel: jest.fn(),
    removeAllChannels: jest.fn()
};
// Helper para criar mock request
const createMockRequest = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: {
        auth_user_id: 'test-user-id',
        company_id: 'test-company-id',
        role: 'admin',
        profile_id: 'test-profile-id',
        name: 'Test User',
        email: 'test@example.com'
    },
    tenant: {
        company_id: 'test-company-id'
    },
    supabase: exports.mockSupabaseClient,
    ...overrides
});
exports.createMockRequest = createMockRequest;
// Helper para criar mock response
const createMockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};
exports.createMockResponse = createMockResponse;
