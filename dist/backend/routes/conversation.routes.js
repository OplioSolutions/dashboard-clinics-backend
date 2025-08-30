"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationRoutes = void 0;
const express_1 = require("express");
const conversation_controller_1 = require("../controllers/conversation.controller");
const router = (0, express_1.Router)();
const controller = new conversation_controller_1.ConversationController();
// Iniciar nova conversa ou retornar ativa existente
router.post('/start', (req, res) => controller.startConversation(req, res));
// Encerrar conversa
router.patch('/:id/close', (req, res) => controller.closeConversation(req, res));
// Listar conversas (com filtro opcional por client_id)
router.get('/', (req, res) => controller.listConversations(req, res));
// Buscar conversa específica com mensagens
router.get('/:id', (req, res) => controller.getConversation(req, res));
exports.conversationRoutes = router;
