import { Request, Response } from 'express'
import { BaseController } from './base'
import { appointmentCreateSchema, appointmentUpdateSchema } from '../schemas'
import { AppError } from '../lib/errors'

export class AppointmentController extends BaseController {
  constructor() {
    super('appointments')
  }

  async list(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { start_date, end_date, client_id, staff_id } = req.query
      const query = this.createQuery(req)
        .select(`
          *,
          client:clients(id, name),
          service:services(id, name, duration),
          staff:users(id, name)
        `)

      if (start_date && typeof start_date === 'string') {
        query.gte('scheduled_at', start_date)
      }
      if (end_date && typeof end_date === 'string') {
        query.lt('scheduled_at', end_date)
      }
      if (client_id && typeof client_id === 'string') {
        query.eq('client_id', client_id)
      }
      if (staff_id && typeof staff_id === 'string') {
        query.eq('staff_id', staff_id)
      }

      const { data, error } = await query.order('scheduled_at')

      if (error) throw error
      return data
    })
  }

  async create(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const newAppointment = appointmentCreateSchema.parse({
        ...req.body,
        company_id: this.getTenantId(req)
      })

      // Verificar disponibilidade
      const { data: conflicts, error: conflictError } = await this.createQuery(req)
        .select('id')
        .eq('staff_id', newAppointment.staff_id)
        .eq('status', 'scheduled')
        .or(`scheduled_at.eq.${newAppointment.scheduled_at}`)

      if (conflictError) throw conflictError
      if (conflicts?.length) {
        throw new AppError(409, 'Time slot not available')
      }

      const { data, error } = await this.getSupabase(req)
        .from(this.tableName)
        .insert(newAppointment)
        .select(`
          *,
          client:clients(id, name),
          service:services(id, name, duration),
          staff:users(id, name)
        `)
        .single()

      if (error) throw error
      return data
    })
  }

  async update(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { id } = req.params
      const updates = appointmentUpdateSchema.parse(req.body)

      const { data, error } = await this.createQuery(req)
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          client:clients(id, name),
          service:services(id, name, duration),
          staff:users(id, name)
        `)
        .single()

      if (error) throw error
      if (!data) throw new AppError(404, 'Appointment not found')
      return data
    })
  }

  async getById(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { id } = req.params

      const { data, error } = await this.createQuery(req)
        .select(`
          *,
          client:clients(id, name),
          service:services(id, name, duration),
          staff:users(id, name)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new AppError(404, 'Appointment not found')
      return data
    })
  }
}
