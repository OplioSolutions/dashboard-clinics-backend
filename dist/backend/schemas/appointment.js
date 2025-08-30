"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentUpdateSchema = exports.appointmentCreateSchema = exports.appointmentSchema = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
exports.appointmentSchema = base_1.baseSchema.extend({
    client_id: zod_1.z.string().uuid(),
    service_id: zod_1.z.string().uuid(),
    staff_id: zod_1.z.string().uuid(),
    scheduled_at: zod_1.z.string().datetime(),
    ended_at: zod_1.z.string().datetime().optional(),
    status: zod_1.z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).default('scheduled'),
    ...base_1.commonFields
});
exports.appointmentCreateSchema = exports.appointmentSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    ended_at: true
});
exports.appointmentUpdateSchema = exports.appointmentCreateSchema.partial();
