import type { Request, Response } from 'express'

interface HealthCheckResponse {
  status: 'ok'
  service: string
  timestamp: string
  uptimeSeconds: number
}

const SERVICE_NAME = 'access-control-api'

export function getHealth(_req: Request, res: Response<HealthCheckResponse>): void {
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  })
}
