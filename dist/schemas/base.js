"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonFields = exports.phoneRegex = exports.baseSchema = void 0;
const zod_1 = require("zod");
exports.baseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().optional(),
    company_id: zod_1.z.string().uuid(),
    created_at: zod_1.z.string().datetime().optional(),
    updated_at: zod_1.z.string().datetime().optional()
});
// Tipos comuns
exports.phoneRegex = /^\+?[1-9]\d{1,14}$/;
exports.commonFields = {
    notes: zod_1.z.string().max(1000).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional()
};
