"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationRoutes = void 0;
const express_1 = require("express");
const integration_controller_1 = require("../controllers/integration.controller");
const db_helpers_1 = require("../lib/db-helpers");
const router = (0, express_1.Router)();
exports.integrationRoutes = router;
const integrationController = new integration_controller_1.IntegrationController((0, db_helpers_1.getSupabaseClient)());
/**
 * GET /api/integrations/available-channels
 * Lista canais disponíveis para integração
 */
router.get('/available-channels', async (req, res) => {
    await integrationController.getAvailableChannels(req, res);
});
/**
 * GET /api/integrations
 * Lista todas as integrações da empresa
 */
router.get('/', async (req, res) => {
    await integrationController.listIntegrations(req, res);
});
/**
 * POST /api/integrations
 * Cria nova integração para a empresa
 * Requer role admin
 */
router.post('/', async (req, res) => {
    await integrationController.createIntegration(req, res);
});
/**
 * GET /api/integrations/:channel
 * Busca integração específica por canal
 */
router.get('/:channel', async (req, res) => {
    await integrationController.getIntegration(req, res);
});
/**
 * PUT /api/integrations/:channel
 * Atualiza integração existente
 * Requer role admin
 */
router.put('/:channel', async (req, res) => {
    await integrationController.updateIntegration(req, res);
});
/**
 * PATCH /api/integrations/:channel/status
 * Ativa/desativa uma integração
 * Requer role admin
 */
router.patch('/:channel/status', async (req, res) => {
    await integrationController.updateIntegrationStatus(req, res);
});
/**
 * POST /api/integrations/:channel/rotate-secret
 * Rotaciona o webhook secret de uma integração
 * Requer role admin
 */
router.post('/:channel/rotate-secret', async (req, res) => {
    await integrationController.rotateWebhookSecret(req, res);
});
/**
 * GET /api/integrations/test/:channel
 * Testa se uma integração está funcionando
 */
router.get('/test/:channel', async (req, res) => {
    await integrationController.testIntegration(req, res);
});
/**
 * DELETE /api/integrations/:channel
 * Remove uma integração (soft delete)
 * Requer role admin
 */
router.delete('/:channel', async (req, res) => {
    await integrationController.deleteIntegration(req, res);
});
