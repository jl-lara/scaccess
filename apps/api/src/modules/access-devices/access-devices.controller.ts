import type {
  AccessDeviceDto,
  DeviceCredentialIssuedDto,
  DeviceSyncStateDto,
  PaginatedResponse,
} from '@scaccess/shared'
import type { Request, Response } from 'express'
import { getValidated } from '../../middleware/validate.js'
import type { PaginationQuery } from '../../utils/pagination.js'
import type {
  AccessDeviceCredentialParams,
  AccessDeviceIdParams,
  CreateAccessDeviceBody,
  UpdateAccessDeviceBody,
} from './access-devices.schemas.js'
import {
  createAccessDevice,
  getAccessDevice,
  getDeviceSyncState,
  issueDeviceCredential,
  listAccessDevices,
  revokeDeviceCredential,
  updateAccessDevice,
} from './access-devices.service.js'

export async function listAccessDevicesHandler(
  _req: Request,
  res: Response<PaginatedResponse<AccessDeviceDto>>,
): Promise<void> {
  const { query } = getValidated<unknown, PaginationQuery>(res)
  const result = await listAccessDevices(query)

  res.status(200).json(result)
}

export async function getAccessDeviceHandler(
  _req: Request,
  res: Response<AccessDeviceDto>,
): Promise<void> {
  const { params } = getValidated<unknown, unknown, AccessDeviceIdParams>(res)
  const device = await getAccessDevice(params.id)

  res.status(200).json(device)
}

export async function createAccessDeviceHandler(
  _req: Request,
  res: Response<AccessDeviceDto>,
): Promise<void> {
  const { body } = getValidated<CreateAccessDeviceBody>(res)
  const device = await createAccessDevice(body)

  res.status(201).json(device)
}

export async function updateAccessDeviceHandler(
  _req: Request,
  res: Response<AccessDeviceDto>,
): Promise<void> {
  const { params, body } = getValidated<
    UpdateAccessDeviceBody,
    unknown,
    AccessDeviceIdParams
  >(res)
  const device = await updateAccessDevice(params.id, body)

  res.status(200).json(device)
}

export async function issueDeviceCredentialHandler(
  _req: Request,
  res: Response<DeviceCredentialIssuedDto>,
): Promise<void> {
  const { params } = getValidated<unknown, unknown, AccessDeviceIdParams>(res)
  const credential = await issueDeviceCredential(params.id)

  res.status(201).json(credential)
}

export async function revokeDeviceCredentialHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const { params } = getValidated<
    unknown,
    unknown,
    AccessDeviceCredentialParams
  >(res)
  await revokeDeviceCredential(params.id, params.credentialId)

  res.status(204).send()
}

export async function getDeviceSyncStateHandler(
  _req: Request,
  res: Response<DeviceSyncStateDto>,
): Promise<void> {
  const { params } = getValidated<unknown, unknown, AccessDeviceIdParams>(res)
  const state = await getDeviceSyncState(params.id)

  res.status(200).json(state)
}
