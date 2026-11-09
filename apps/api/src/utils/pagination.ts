import type { PaginatedResponse } from '@scaccess/shared'
import { z } from 'zod'

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

export function toPrismaSkipTake(query: PaginationQuery): { skip: number; take: number } {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  }
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  query: PaginationQuery,
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  }
}
