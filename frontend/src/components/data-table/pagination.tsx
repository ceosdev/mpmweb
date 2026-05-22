import { Button } from '@/components/ui/button'
import type { PaginationMeta } from '@/types/api'

interface PaginationProps {
  meta: PaginationMeta
  onChange: (page: number) => void
}

/**
 * Footer pagination shared by every CRUD listing. Renders nothing when there
 * is only one page so the caller can drop it in unconditionally.
 */
export function Pagination({ meta, onChange }: PaginationProps) {
  if (meta.lastPage <= 1) return null

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Página {meta.page} de {meta.lastPage} · {meta.total} registros
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onChange(meta.page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.lastPage}
          onClick={() => onChange(meta.page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  )
}
