"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = void 0;
const express_1 = require("express");
const chat_controller_1 = require("../controllers/chat.controller");
const router = (0, express_1.Router)();
exports.chatRoutes = router;
const controller = new chat_controller_1.ChatController();
// Endpoint principal para envio de mensagens
router.post('/send', (req, res) => controller.sendMessage(req, res));
// Endpoint para callback de status do n8n (opcional)
router.post('/callback', (req, res) => controller.handleDeliveryCallback(req, res));
