"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseController = void 0;
const errors_1 = require("../lib/errors");
class BaseController {
    constructor(tableName, supabase) {
        this.tableName = tableName;
        this.supabase = supabase;
    }
    getSupabase(req) {
        if (this.supabase) {
            return this.supabase;
        }
        if (!req.supabase) {
            throw new Error('Supabase client not found in request');
        }
        return req.supabase;
    }
    getTenantId(req) {
        if (!req.tenant?.company_id) {
            throw new Error('Company ID not found in request');
        }
        return req.tenant.company_id;
    }
    createQuery(req) {
        const supabase = this.getSupabase(req);
        const query = supabase.from(this.tableName);
        return query.eq('company_id', this.getTenantId(req));
    }
    async handleRequest(req, res, action) {
        try {
            const result = await action();
            return res.json(result);
        }
        catch (error) {
            return (0, errors_1.handleError)(error, res);
        }
    }
}
exports.BaseController = BaseController;
