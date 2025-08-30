"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTenantScope = withTenantScope;
function withTenantScope(req, res, next) {
    if (!req.user?.company_id) {
        return res.status(403).json({ error: 'Company context required' });
    }
    // Injetar company_id no request para uso nas queries
    ;
    req.tenant = {
        company_id: req.user.company_id
    };
    next();
}
