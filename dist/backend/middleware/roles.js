"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = isAdmin;
exports.isStaff = isStaff;
exports.requireAdmin = requireAdmin;
exports.requireStaff = requireStaff;
function isAdmin(req) {
    return req.user?.role === 'admin';
}
function isStaff(req) {
    return req.user?.role === 'staff';
}
// Middleware para rotas que exigem admin
function requireAdmin(req, res, next) {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
// Middleware para rotas que exigem staff ou admin
function requireStaff(req, res, next) {
    if (!isStaff(req) && !isAdmin(req)) {
        return res.status(403).json({ error: 'Staff access required' });
    }
    next();
}
