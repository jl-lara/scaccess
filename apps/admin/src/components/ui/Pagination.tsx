import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  totalPages: number
  disabled?: boolean
  onPageChange: (page: number) => void
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  disabled = false,
  onPageChange,
}: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1)
  const recordLabel = total === 1 ? 'registro' : 'registros'

  return (
    <div className="pagination-bar">
      <span className="table-meta" aria-live="polite">
        {total} {recordLabel}. Pagina {page} de {safeTotalPages}. {pageSize} por pagina.
      </span>
      <nav className="pagination-controls" aria-label="Paginacion de resultados">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Anterior
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= safeTotalPages}
        >
          Siguiente
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </nav>
    </div>
  )
}
