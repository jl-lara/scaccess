import type { AccessEventDto, PaginatedResponse } from '@scaccess/shared'
import type { Request, Response } from 'express'
import { getAuthenticatedUser } from '../../middleware/auth.js'
import { getValidated } from '../../middleware/validate.js'
import { ApiError } from '../../utils/ApiError.js'
import type { PaginationQuery } from '../../utils/pagination.js'
import type {
  AccessEventIdParams,
  AccessEventListQuery,
} from './access-events.schemas.js'
import {
  getAccessEvent,
  getMyAccessEvent,
  listAccessEvents,
  listMyAccessEvents,
} from './access-events.service.js'

export async function listAccessEventsHandler(
  _req: Request,
  res: Response<PaginatedResponse<AccessEventDto>>,
): Promise<void> {
  const { query } = getValidated<unknown, AccessEventListQuery>(res)
  const result = await listAccessEvents(query)

  res.status(200).json(result)
}

export async function getAccessEventHandler(
  _req: Request,
  res: Response<AccessEventDto>,
): Promise<void> {
  const { params } = getValidated<unknown, unknown, AccessEventIdParams>(res)
  const event = await getAccessEvent(params.id)

  res.status(200).json(event)
}

export async function listMyAccessEventsHandler(
  req: Request,
  res: Response<PaginatedResponse<AccessEventDto>>,
): Promise<void> {
  const user = getAuthenticatedUser(req, res)
  const { query } = getValidated<unknown, PaginationQuery>(res)

  if (user.employeeId === null) {
    // Defensive guard: requireEmployeeAccount already enforces this.
    throw ApiError.forbidden('Employee account required')
  }

  const result = await listMyAccessEvents(user.employeeId, query)

  res.status(200).json(result)
}

export async function getMyAccessEventHandler(
  req: Request,
  res: Response<AccessEventDto>,
): Promise<void> {
  const user = getAuthenticatedUser(req, res)
  const { params } = getValidated<unknown, unknown, AccessEventIdParams>(res)

  if (user.employeeId === null) {
    throw ApiError.forbidden('Employee account required')
  }

  const event = await getMyAccessEvent(user.employeeId, params.id)

  res.status(200).json(event)
}
