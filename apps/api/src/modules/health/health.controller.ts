import type { HealthCheckResponse } from '@scaccess/shared'
import type { Request, Response } from 'express'

const SERVICE_NAME = 'access-control-api'

export function getHealth(_req: Request, res: Response<HealthCheckResponse>): void {
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  })
}
