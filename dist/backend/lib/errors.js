"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.handleError = handleError;
const zod_1 = require("zod");
class AppError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
function handleError(error, res) {
    if (error instanceof zod_1.ZodError) {
        return res.status(400).json({
            error: 'Validation error',
            details: error.errors
        });
    }
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            error: error.message
        });
    }
    console.error('Unexpected error:', error);
    return res.status(500).json({
        error: 'Internal server error'
    });
}
