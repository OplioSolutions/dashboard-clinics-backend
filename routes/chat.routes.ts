import { Router } from 'express'
import { ChatController } from '../controllers/chat.controller'

const router = Router()
const controller = new ChatController()

// Endpoint principal para envio de mensagens
router.post('/send', (req, res) => controller.sendMessage(req, res))

// Endpoint para callback de status do n8n (opcional)
router.post('/callback', (req, res) => controller.handleDeliveryCallback(req, res))

export { router as chatRoutes }
