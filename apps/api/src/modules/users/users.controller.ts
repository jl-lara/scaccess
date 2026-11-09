import type { RequestHandler } from 'express'
import { getAuthenticatedUser } from '../../middleware/auth.js'
import { getValidated } from '../../middleware/validate.js'
import {
  createUser,
  getUserById,
  listUsers,
  updateUser,
  type CreateUserInput,
  type ListUsersFilters,
  type UpdateUserInput,
} from './users.service.js'
import type { CreateUserBody, ListUsersQuery, UpdateUserBody, UserIdParams } from './users.schemas.js'

export const getUsers: RequestHandler = async (_req, res, next) => {
  try {
    const { query } = getValidated<unknown, ListUsersQuery, unknown>(res)
    const result = await listUsers(query as ListUsersFilters)
    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

export const getUser: RequestHandler = async (_req, res, next) => {
  try {
    const { params } = getValidated<unknown, unknown, UserIdParams>(res)
    const account = await getUserById(params.id)
    res.status(200).json(account)
  } catch (error) {
    next(error)
  }
}

export const postUser: RequestHandler = async (req, res, next) => {
  try {
    const { body } = getValidated<CreateUserBody, unknown, unknown>(res)
    const currentUser = getAuthenticatedUser(req, res)
    const account = await createUser(body as CreateUserInput, currentUser.id)
    res.status(201).json(account)
  } catch (error) {
    next(error)
  }
}

export const patchUser: RequestHandler = async (req, res, next) => {
  try {
    const { body, params } = getValidated<UpdateUserBody, unknown, UserIdParams>(res)
    const currentUser = getAuthenticatedUser(req, res)
    const account = await updateUser(params.id, body as UpdateUserInput, currentUser.id)
    res.status(200).json(account)
  } catch (error) {
    next(error)
  }
}
