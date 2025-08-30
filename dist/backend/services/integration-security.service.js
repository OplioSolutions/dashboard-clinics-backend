"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationSecurityService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const errors_1 = require("../lib/errors");
/**
 * Service responsável pela criptografia/descriptografia de credenciais de integração
 * Cada empresa tem suas credenciais criptografadas com uma chave derivada única
 */
class IntegrationSecurityService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16; // 128 bits
        this.tagLength = 16; // 128 bits
        this.saltLength = 32; // 256 bits
    }
    // Master key derivada das variáveis de ambiente
    getMasterKey() {
        const masterKey = process.env.INTEGRATION_MASTER_KEY || process.env.SUPABASE_JWT_SECRET || 'dev-master-key-change-in-production';
        if (process.env.NODE_ENV === 'production' && !process.env.INTEGRATION_MASTER_KEY) {
            console.warn('WARNING: Using fallback master key. Set INTEGRATION_MASTER_KEY in production!');
        }
        return masterKey;
    }
    /**
     * Deriva uma chave específica para a empresa usando PBKDF2
     */
    deriveCompanyKey(companyId, salt) {
        const masterKey = this.getMasterKey();
        const keyMaterial = `${masterKey}:company:${companyId}`;
        return crypto_1.default.pbkdf2Sync(keyMaterial, salt, 100000, this.keyLength, 'sha512');
    }
    /**
     * Criptografa um valor usando a chave específica da empresa
     */
    encrypt(value, companyId) {
        try {
            if (!value || !companyId) {
                throw new errors_1.AppError(400, 'Value and companyId are required for encryption');
            }
            // Gerar salt e IV aleatórios
            const salt = crypto_1.default.randomBytes(this.saltLength);
            const iv = crypto_1.default.randomBytes(this.ivLength);
            // Derivar chave específica da empresa
            const key = this.deriveCompanyKey(companyId, salt);
            // Criptografar usando AES-GCM
            const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
            cipher.setAAD(Buffer.from(companyId, 'utf8')); // Additional authenticated data
            let encrypted = cipher.update(value, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const tag = cipher.getAuthTag();
            // Combinar salt + iv + tag + encrypted em uma string base64
            const combined = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);
            return combined.toString('base64');
        }
        catch (error) {
            console.error('Encryption error:', error);
            throw new errors_1.AppError(500, 'Failed to encrypt value');
        }
    }
    /**
     * Descriptografa um valor usando a chave específica da empresa
     */
    decrypt(encryptedValue, companyId) {
        try {
            if (!encryptedValue || !companyId) {
                throw new errors_1.AppError(400, 'EncryptedValue and companyId are required for decryption');
            }
            // Decodificar base64 e extrair componentes
            const combined = Buffer.from(encryptedValue, 'base64');
            if (combined.length < this.saltLength + this.ivLength + this.tagLength) {
                throw new errors_1.AppError(400, 'Invalid encrypted value format');
            }
            const salt = combined.subarray(0, this.saltLength);
            const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength);
            const tag = combined.subarray(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
            const encrypted = combined.subarray(this.saltLength + this.ivLength + this.tagLength);
            // Derivar a mesma chave
            const key = this.deriveCompanyKey(companyId, salt);
            // Descriptografar usando AES-GCM
            const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAAD(Buffer.from(companyId, 'utf8'));
            decipher.setAuthTag(tag);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            console.error('Decryption error:', error);
            throw new errors_1.AppError(500, 'Failed to decrypt value');
        }
    }
    /**
     * Gera um webhook secret seguro para uma empresa
     */
    generateWebhookSecret(companyId, channel) {
        const randomBytes = crypto_1.default.randomBytes(32);
        const timestamp = Date.now().toString();
        const data = `${companyId}:${channel}:${timestamp}:${randomBytes.toString('hex')}`;
        return crypto_1.default.createHash('sha256').update(data).digest('hex').substring(0, 32);
    }
    /**
     * Valida se uma string é um valor criptografado válido
     */
    isEncrypted(value) {
        try {
            const combined = Buffer.from(value, 'base64');
            return combined.length >= this.saltLength + this.ivLength + this.tagLength;
        }
        catch {
            return false;
        }
    }
    /**
     * Gera uma API key segura (para armazenar tokens de terceiros criptografados)
     */
    generateApiKey() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    /**
     * Hash seguro para comparação (para casos onde não precisamos descriptografar)
     */
    hash(value, companyId) {
        const salt = crypto_1.default.createHash('sha256').update(companyId).digest();
        return crypto_1.default.pbkdf2Sync(value, salt, 100000, 32, 'sha512').toString('hex');
    }
    /**
     * Verifica se um valor corresponde ao hash
     */
    verifyHash(value, hash, companyId) {
        try {
            const computedHash = this.hash(value, companyId);
            return crypto_1.default.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
        }
        catch {
            return false;
        }
    }
    /**
     * Rotaciona a criptografia de um valor (re-criptografa com nova salt/iv)
     * Útil para rotação periódica de segurança
     */
    rotateEncryption(encryptedValue, companyId) {
        const decrypted = this.decrypt(encryptedValue, companyId);
        return this.encrypt(decrypted, companyId);
    }
}
exports.IntegrationSecurityService = IntegrationSecurityService;
