import { Request, Response, NextFunction } from 'express'

export function withTenantScope(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user?.company_id) {
    return res.status(403).json({ error: 'Company context required' })
  }
  
  // Injetar company_id no request para uso nas queries
  ;(req as any).tenant = {
    company_id: (req as any).user.company_id
  }
  
  next()
}
