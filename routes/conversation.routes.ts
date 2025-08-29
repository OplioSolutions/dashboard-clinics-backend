import { Router } from 'express'
import { ConversationController } from '../controllers/conversation.controller'

const router = Router()
const controller = new ConversationController()

// Iniciar nova conversa ou retornar ativa existente
router.post('/start', (req, res) => controller.startConversation(req, res))

// Encerrar conversa
router.patch('/:id/close', (req, res) => controller.closeConversation(req, res))

// Listar conversas (com filtro opcional por client_id)
router.get('/', (req, res) => controller.listConversations(req, res))

// Buscar conversa específica com mensagens
router.get('/:id', (req, res) => controller.getConversation(req, res))

export const conversationRoutes = router
