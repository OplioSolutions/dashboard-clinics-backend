import { Router } from 'express'
import { InteractionController } from '../controllers/interaction.controller'

const router = Router()
const controller = new InteractionController()

// Criar nova interação
router.post('/', (req, res) => controller.createInteraction(req, res))

// Atualizar status da interação
router.patch('/:id/status', (req, res) => controller.updateStatus(req, res))

// Listar interações de uma conversa
router.get('/', (req, res) => controller.listInteractions(req, res))

export const interactionRoutes = router
