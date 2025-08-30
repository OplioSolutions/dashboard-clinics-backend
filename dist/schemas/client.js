"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientUpdateSchema = exports.clientCreateSchema = exports.clientSchema = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
exports.clientSchema = base_1.baseSchema.extend({
    name: zod_1.z.string().min(2).max(100),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().regex(base_1.phoneRegex, 'Invalid phone number format').optional(),
    status: zod_1.z.enum(['active', 'inactive']).default('active'),
    address: zod_1.z.string().max(200).optional(),
    ...base_1.commonFields
});
exports.clientCreateSchema = exports.clientSchema.omit({
    id: true,
    created_at: true,
    updated_at: true
});
exports.clientUpdateSchema = exports.clientCreateSchema.partial();
