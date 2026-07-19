import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PaginationMeta } from '@/types/api'

interface PaginationProps {
  meta: PaginationMeta
  onChange: (page: number) => void
}

/**
 * Footer pagination shared by every CRUD listing. Renders nothing when there
 * is only one page so the caller can drop it in unconditionally.
 *
 * Navegação em ícones (compacta): **primeira / anterior / próxima / última**.
 * Os chevrons duplos (`ChevronsLeft`/`ChevronsRight`) saltam para os extremos.
 */
export function Pagination({ meta, onChange }: PaginationProps) {
  if (meta.lastPage <= 1) return null

  const isFirst = meta.page <= 1
  const isLast = meta.page >= meta.lastPage

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Página {meta.page} de {meta.lastPage} · {meta.total} registros
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={isFirst}
          onClick={() => onChange(1)}
          aria-label="Primeira página"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={isFirst}
          onClick={() => onChange(meta.page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={isLast}
          onClick={() => onChange(meta.page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={isLast}
          onClick={() => onChange(meta.lastPage)}
          aria-label="Última página"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
