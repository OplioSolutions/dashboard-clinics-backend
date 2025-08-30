"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceUpdateSchema = exports.serviceCreateSchema = exports.serviceSchema = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
exports.serviceSchema = base_1.baseSchema.extend({
    name: zod_1.z.string().min(2).max(100),
    description: zod_1.z.string().max(500).optional(),
    duration: zod_1.z.number().int().min(15).max(480), // duração em minutos (max 8h)
    price: zod_1.z.number().min(0),
    active: zod_1.z.boolean().default(true),
    ...base_1.commonFields
});
exports.serviceCreateSchema = exports.serviceSchema.omit({
    id: true,
    created_at: true,
    updated_at: true
});
exports.serviceUpdateSchema = exports.serviceCreateSchema.partial();
