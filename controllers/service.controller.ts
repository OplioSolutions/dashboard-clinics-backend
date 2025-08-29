import { Request, Response } from 'express'
import { BaseController } from './base'
import { serviceCreateSchema, serviceUpdateSchema } from '../schemas'
import { AppError } from '../lib/errors'

export class ServiceController extends BaseController {
  constructor() {
    super('services')
  }

  async list(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const query = this.createQuery(req)

      if (!req.query.includeInactive) {
        query.eq('active', true)
      }

      const { data, error } = await query
        .select('*')
        .order('name')

      if (error) throw error
      return data
    })
  }

  async create(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const newService = serviceCreateSchema.parse({
        ...req.body,
        company_id: this.getTenantId(req)
      })

      const { data, error } = await this.getSupabase(req)
        .from(this.tableName)
        .insert(newService)
        .select()
        .single()

      if (error) throw error
      return data
    })
  }

  async update(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { id } = req.params
      const updates = serviceUpdateSchema.parse(req.body)

      const { data, error } = await this.createQuery(req)
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new AppError(404, 'Service not found')
      return data
    })
  }

  async getById(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { id } = req.params

      const { data, error } = await this.createQuery(req)
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new AppError(404, 'Service not found')
      return data
    })
  }
}
