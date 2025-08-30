"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.outboundCallbackAuth = outboundCallbackAuth;
exports.simpleCallbackAuth = simpleCallbackAuth;
const crypto_1 = __importDefault(require("crypto"));
const errors_1 = require("../lib/errors");
/**
 * Middleware para autenticar callbacks do n8n para status de mensagens outbound
 * Usa um secret compartilhado para validação
 */
function outboundCallbackAuth(req, res, next) {
    try {
        // Obter secret do ambiente
        const webhookSecret = process.env.N8N_OUTBOUND_CALLBACK_SECRET;
        if (!webhookSecret) {
            console.error('N8N_OUTBOUND_CALLBACK_SECRET not configured');
            throw new errors_1.AppError(500, 'Callback authentication not configured');
        }
        // Verificar se há assinatura no header
        const signature = req.get('x-webhook-signature') || req.get('x-n8n-signature');
        if (!signature) {
            throw new errors_1.AppError(401, 'Missing webhook signature');
        }
        // Obter body da requisição
        let body;
        if (Buffer.isBuffer(req.body)) {
            body = req.body.toString('utf8');
        }
        else if (typeof req.body === 'string') {
            body = req.body;
        }
        else {
            body = JSON.stringify(req.body);
        }
        // Calcular HMAC esperado
        const expectedSignature = crypto_1.default
            .createHmac('sha256', webhookSecret)
            .update(body, 'utf8')
            .digest('hex');
        const expectedHeader = `sha256=${expectedSignature}`;
        // Comparação segura contra timing attacks
        const signatureBuffer = Buffer.from(signature, 'utf8');
        const expectedBuffer = Buffer.from(expectedHeader, 'utf8');
        if (signatureBuffer.length !== expectedBuffer.length) {
            throw new errors_1.AppError(401, 'Invalid webhook signature');
        }
        const isValid = crypto_1.default.timingSafeEqual(signatureBuffer, expectedBuffer);
        if (!isValid) {
            throw new errors_1.AppError(401, 'Invalid webhook signature');
        }
        // Se chegou até aqui, a assinatura é válida
        next();
    }
    catch (error) {
        console.error('Outbound callback auth error:', error);
        if (error instanceof errors_1.AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }
        return res.status(500).json({
            success: false,
            error: 'Internal server error during callback authentication'
        });
    }
}
/**
 * Middleware alternativo usando token simples (menos seguro, mas mais simples para testes)
 */
function simpleCallbackAuth(req, res, next) {
    try {
        const expectedToken = process.env.N8N_OUTBOUND_CALLBACK_TOKEN;
        if (!expectedToken) {
            throw new errors_1.AppError(500, 'Callback token not configured');
        }
        const providedToken = req.get('x-callback-token') || req.get('authorization')?.replace('Bearer ', '');
        if (!providedToken) {
            throw new errors_1.AppError(401, 'Missing callback token');
        }
        if (providedToken !== expectedToken) {
            throw new errors_1.AppError(401, 'Invalid callback token');
        }
        next();
    }
    catch (error) {
        console.error('Simple callback auth error:', error);
        if (error instanceof errors_1.AppError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        }
        return res.status(500).json({
            success: false,
            error: 'Internal server error during callback authentication'
        });
    }
}
