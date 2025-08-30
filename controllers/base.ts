import { Request, Response } from 'express'
import { SupabaseClient } from '@supabase/supabase-js'
import { handleError } from '../lib/errors'

export abstract class BaseController {
  protected tableName: string
  protected supabase?: SupabaseClient

  constructor(tableName: string, supabase?: SupabaseClient) {
    this.tableName = tableName
    this.supabase = supabase
  }

  protected getSupabase(req: Request): SupabaseClient {
    if (this.supabase) {
      return this.supabase
    }
    if (!(req as any).supabase) {
      throw new Error('Supabase client not found in request')
    }
    return (req as any).supabase
  }

  protected getTenantId(req: Request): string {
    if (!(req as any).tenant?.company_id) {
      throw new Error('Company ID not found in request')
    }
    return (req as any).tenant.company_id
  }

  protected createQuery(req: Request) {
    const supabase = this.getSupabase(req)
    const query = supabase.from(this.tableName) as any
    return query.eq('company_id', this.getTenantId(req))
  }

  protected async handleRequest(
    req: Request,
    res: Response,
    action: () => Promise<any>
  ) {
    try {
      const result = await action()
      return res.json(result)
    } catch (error) {
      return handleError(error, res)
    }
  }
}