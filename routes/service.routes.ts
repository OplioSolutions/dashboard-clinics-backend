import { Router } from 'express'
import { ServiceController } from '../controllers/service.controller'
import { requireAdmin } from '../middleware/roles'

const router = Router()
const controller = new ServiceController()

router.get('/', (req, res) => controller.list(req, res))
router.post('/', requireAdmin, (req, res) => controller.create(req, res))
router.get('/:id', (req, res) => controller.getById(req, res))
router.patch('/:id', requireAdmin, (req, res) => controller.update(req, res))

export const serviceRoutes = router
