import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { withTenantScope } from '../middleware/tenant'
import { clientRoutes } from './client.routes'
import { serviceRoutes } from './service.routes'
import { appointmentRoutes } from './appointment.routes'
import { conversationRoutes } from './conversation.routes'
import { interactionRoutes } from './interaction.routes'
import { integrationRoutes } from './integration.routes'
import { chatRoutes } from './chat.routes'

const router = Router()

// Aplicar middlewares de autenticação e tenant scope em todas as rotas
router.use(requireAuth)
router.use(withTenantScope)

// Registrar rotas
router.use('/clients', clientRoutes)
router.use('/services', serviceRoutes)
router.use('/appointments', appointmentRoutes)
router.use('/conversations', conversationRoutes)
router.use('/interactions', interactionRoutes)
router.use('/integrations', integrationRoutes)
router.use('/chat', chatRoutes)

export default router