"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionRoutes = void 0;
const express_1 = require("express");
const interaction_controller_1 = require("../controllers/interaction.controller");
const router = (0, express_1.Router)();
const controller = new interaction_controller_1.InteractionController();
// Criar nova interação
router.post('/', (req, res) => controller.createInteraction(req, res));
// Atualizar status da interação
router.patch('/:id/status', (req, res) => controller.updateStatus(req, res));
// Listar interações de uma conversa
router.get('/', (req, res) => controller.listInteractions(req, res));
exports.interactionRoutes = router;
