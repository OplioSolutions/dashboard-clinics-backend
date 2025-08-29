import { Router } from 'express'
import { ClientController } from '../controllers/client.controller'

const router = Router()
const controller = new ClientController()

router.get('/', (req, res) => controller.list(req, res))
router.post('/', (req, res) => controller.create(req, res))
router.get('/:id', (req, res) => controller.getById(req, res))
router.patch('/:id', (req, res) => controller.update(req, res))

export const clientRoutes = router
