"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookAuth = webhookAuth;
exports.simpleTokenAuth = simpleTokenAuth;
exports.dynamicWebhookAuth = dynamicWebhookAuth;
exports.generateWebhookSignature = generateWebhookSignature;
const crypto_1 = __importDefault(require("crypto"));
const errors_1 = require("../lib/errors");
const integration_helper_1 = require("../lib/integration-helper");
const db_helpers_1 = require("../lib/db-helpers");
/**
 * Middleware para validar assinatura HMAC em webhooks
 * Protege contra requisições não autorizadas
 */
function webhookAuth(config) {
    const { secret, headerName = 'x-webhook-signature', algorithm = 'sha256' } = config;
    return (req, res, next) => {
        try {
            // Obter assinatura do header
            const signature = req.get(headerName);
            if (!signature) {
                throw new errors_1.AppError(401, 'Missing webhook signature');
            }
            // Obter o corpo da requisição como string
            let body;
            if (typeof req.body === 'string') {
                body = req.body;
            }
            else if (req.body && typeof req.body === 'object') {
                body = JSON.stringify(req.body);
            }
            else {
                throw new errors_1.AppError(400, 'Invalid request body');
            }
            // Calcular assinatura esperada
            const expectedSignature = crypto_1.default
                .createHmac(algorithm, secret)
                .update(body, 'utf8')
                .digest('hex');
            // Formato esperado: sha256=<hash>
            const expectedHeader = `${algorithm}=${expectedSignature}`;
            // Comparação segura contra timing attacks
            const isValid = crypto_1.default.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedHeader, 'utf8'));
            if (!isValid) {
                throw new errors_1.AppError(401, 'Invalid webhook signature');
            }
            next();
        }
        catch (error) {
            console.error('Webhook authentication failed:', error);
            if (error instanceof errors_1.AppError) {
                return res.status(error.statusCode).json({
                    success: false,
                    error: error.message
                });
            }
            return res.status(500).json({
                success: false,
                error: 'Internal server error during authentication'
            });
        }
    };
}
/**
 * Middleware simplificado para validação apenas com secret (token)
 * Para casos onde não há necessidade de HMAC completo
 */
function simpleTokenAuth(expectedToken, headerName = 'x-webhook-token') {
    return (req, res, next) => {
        try {
            const token = req.get(headerName);
            if (!token) {
                throw new errors_1.AppError(401, 'Missing webhook token');
            }
            if (token !== expectedToken) {
                throw new errors_1.AppError(401, 'Invalid webhook token');
            }
            next();
        }
        catch (error) {
            console.error('Webhook token authentication failed:', error);
            if (error instanceof errors_1.AppError) {
                return res.status(error.statusCode).json({
                    success: false,
                    error: error.message
                });
            }
            return res.status(500).json({
                success: false,
                error: 'Internal server error during token authentication'
            });
        }
    };
}
/**
 * Middleware dinâmico que busca credenciais por empresa
 * Substitui o middleware estático em produção
 */
function dynamicWebhookAuth(channel) {
    return async (req, res, next) => {
        try {
            // Obter payload para extrair company_id
            let payload;
            if (req.body && typeof req.body === 'object') {
                payload = req.body;
            }
            else if (req.body && Buffer.isBuffer(req.body)) {
                try {
                    payload = JSON.parse(req.body.toString());
                }
                catch {
                    throw new errors_1.AppError(400, 'Invalid JSON in request body');
                }
            }
            else {
                throw new errors_1.AppError(400, 'Missing request body');
            }
            const companyId = payload.company_id;
            if (!companyId) {
                throw new errors_1.AppError(400, 'Missing company_id in payload');
            }
            // Verificar se o canal do payload corresponde à rota
            if (payload.channel && payload.channel !== channel) {
                throw new errors_1.AppError(400, `Channel mismatch. Expected ${channel}, got ${payload.channel}`);
            }
            // Buscar credenciais específicas da empresa (sistema multi-tenant puro)
            const integrationHelper = new integration_helper_1.IntegrationHelper((0, db_helpers_1.getSupabaseClient)());
            const credentials = await integrationHelper.getCompanyCredentials(companyId, channel);
            if (!credentials) {
                throw new errors_1.AppError(401, `No valid credentials found for company ${companyId} and channel ${channel}`);
            }
            // Validar assinatura HMAC
            const signature = req.get('x-webhook-signature');
            if (!signature) {
                throw new errors_1.AppError(401, 'Missing webhook signature');
            }
            const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            const expectedSignature = crypto_1.default
                .createHmac('sha256', credentials.webhookSecret)
                .update(body, 'utf8')
                .digest('hex');
            const expectedHeader = `sha256=${expectedSignature}`;
            // Comparação segura contra timing attacks
            // Garantir que os buffers tenham o mesmo tamanho
            const signatureBuffer = Buffer.from(signature, 'utf8');
            const expectedBuffer = Buffer.from(expectedHeader, 'utf8');
            if (signatureBuffer.length !== expectedBuffer.length) {
                throw new errors_1.AppError(401, 'Invalid webhook signature');
            }
            const isValid = crypto_1.default.timingSafeEqual(signatureBuffer, expectedBuffer);
            if (!isValid) {
                throw new errors_1.AppError(401, 'Invalid webhook signature');
            }
            // Anexar informações da integração à request para uso posterior
            req.integration = {
                companyId,
                channel,
                credentials
            };
            next();
        }
        catch (error) {
            console.error(`Dynamic webhook authentication failed for channel ${channel}:`, error);
            if (error instanceof errors_1.AppError) {
                return res.status(error.statusCode).json({
                    success: false,
                    error: error.message
                });
            }
            return res.status(500).json({
                success: false,
                error: 'Internal server error during authentication'
            });
        }
    };
}
/**
 * Middleware de autenticação pura (removido fallback híbrido)
 * Sistema multi-tenant - cada empresa deve ter integração configurada
 */
/**
 * Helper para gerar assinatura HMAC (útil para testes)
 */
function generateWebhookSignature(payload, secret, algorithm = 'sha256') {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signature = crypto_1.default
        .createHmac(algorithm, secret)
        .update(body, 'utf8')
        .digest('hex');
    return `${algorithm}=${signature}`;
}
