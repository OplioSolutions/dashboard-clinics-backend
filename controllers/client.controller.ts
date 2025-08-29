import { Request, Response } from 'express'
import { BaseController } from './base'
import { clientCreateSchema, clientUpdateSchema } from '../schemas'
import { AppError } from '../lib/errors'

export class ClientController extends BaseController {
  constructor() {
    super('clients')
  }

  async list(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { search } = req.query
      const query = this.createQuery(req)

      if (typeof search === 'string' && search.trim()) {
        query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
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
      const newClient = clientCreateSchema.parse({
        ...req.body,
        company_id: this.getTenantId(req)
      })

      const { data, error } = await this.getSupabase(req)
        .from(this.tableName)
        .insert(newClient)
        .select()
        .single()

      if (error) throw error
      return data
    })
  }

  async update(req: Request, res: Response) {
    return this.handleRequest(req, res, async () => {
      const { id } = req.params
      const updates = clientUpdateSchema.parse(req.body)

      const { data, error } = await this.createQuery(req)
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new AppError(404, 'Client not found')
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
      if (!data) throw new AppError(404, 'Client not found')
      return data
    })
  }
}
