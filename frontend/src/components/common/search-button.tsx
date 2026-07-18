import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SearchButtonProps extends React.ComponentProps<typeof Button> {
  /** Enquanto `true`, mostra o spinner e desabilita o botão — o feedback do clique. */
  loading?: boolean
}

/**
 * Botão "Pesquisar" padrão das telas de listagem. Dispara a consulta dos filtros
 * (regra: filtro só consulta no clique — ver [[simple-crud-pattern]] e o hook
 * `useSearchFilters`). Enquanto a consulta está em andamento (`loading`), troca o
 * ícone de lupa por um spinner e desabilita, dando o feedback visual do clique.
 */
export function SearchButton({ loading = false, disabled, ...props }: SearchButtonProps) {
  return (
    <Button type="button" {...props} disabled={loading || disabled}>
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Search className="size-4" />
      )}
      Pesquisar
    </Button>
  )
}
