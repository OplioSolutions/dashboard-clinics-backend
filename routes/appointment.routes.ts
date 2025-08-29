import { Router } from 'express'
import { AppointmentController } from '../controllers/appointment.controller'

const router = Router()
const controller = new AppointmentController()

router.get('/', (req, res) => controller.list(req, res))
router.post('/', (req, res) => controller.create(req, res))
router.get('/:id', (req, res) => controller.getById(req, res))
router.patch('/:id', (req, res) => controller.update(req, res))

export const appointmentRoutes = router
