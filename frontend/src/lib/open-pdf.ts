import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'

/**
 * Abre um PDF numa nova aba — regra do sistema para toda impressão.
 *
 * Sem `tab`, abre `window.open('', '_blank')` **na hora** (tem de rodar dentro
 * do clique, senão o navegador bloqueia como popup), baixa o PDF e aponta a aba
 * para um object URL. Os disparos automáticos (depois de finalizar/entregar/
 * devolver) abrem a aba no clique de confirmação e a passam em `tab`.
 * Em erro, fecha a aba e mostra o toast com a mensagem da API.
 */
export async function openPdf(
  fetchPdf: () => Promise<Blob>,
  tab?: Window | null,
): Promise<void> {
  const target = tab ?? window.open('', '_blank')
  try {
    const blob = await fetchPdf()
    const url = URL.createObjectURL(blob)
    if (target && !target.closed) {
      target.location.href = url
    } else {
      // Aba bloqueada ou fechada pelo usuário: última tentativa.
      window.open(url, '_blank')
    }
  } catch (error) {
    target?.close()
    toast.error(getErrorMessage(await readBlobError(error)))
  }
}

/** Erro de request `blob`: o corpo JSON da API chega como Blob — lê o texto. */
async function readBlobError(error: unknown): Promise<unknown> {
  if (error instanceof AxiosError && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text())
    } catch {
      // corpo não era JSON: segue com a mensagem genérica do axios
    }
  }
  return error
}
