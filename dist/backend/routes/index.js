"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const client_routes_1 = require("./client.routes");
const service_routes_1 = require("./service.routes");
const appointment_routes_1 = require("./appointment.routes");
const conversation_routes_1 = require("./conversation.routes");
const interaction_routes_1 = require("./interaction.routes");
const integration_routes_1 = require("./integration.routes");
const chat_routes_1 = require("./chat.routes");
const router = (0, express_1.Router)();
// Aplicar middlewares de autenticação e tenant scope em todas as rotas
router.use(auth_1.requireAuth);
router.use(tenant_1.withTenantScope);
// Registrar rotas
router.use('/clients', client_routes_1.clientRoutes);
router.use('/services', service_routes_1.serviceRoutes);
router.use('/appointments', appointment_routes_1.appointmentRoutes);
router.use('/conversations', conversation_routes_1.conversationRoutes);
router.use('/interactions', interaction_routes_1.interactionRoutes);
router.use('/integrations', integration_routes_1.integrationRoutes);
router.use('/chat', chat_routes_1.chatRoutes);
exports.default = router;
