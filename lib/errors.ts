import { ZodError } from 'zod'
import { Response } from 'express'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleError(error: any, res: Response) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.errors
    })
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message
    })
  }

  console.error('Unexpected error:', error)
  return res.status(500).json({
    error: 'Internal server error'
  })
}
