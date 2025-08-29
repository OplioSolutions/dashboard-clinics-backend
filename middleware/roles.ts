import { Request, Response, NextFunction } from 'express'

export function isAdmin(req: Request) {
  return (req as any).user?.role === 'admin'
}

export function isStaff(req: Request) {
  return (req as any).user?.role === 'staff'
}

// Middleware para rotas que exigem admin
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

// Middleware para rotas que exigem staff ou admin
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!isStaff(req) && !isAdmin(req)) {
    return res.status(403).json({ error: 'Staff access required' })
  }
  next()
}
